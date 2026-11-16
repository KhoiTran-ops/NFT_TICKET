import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { MockChain } from "../src/modules/chain/mock-chain.js";
import { IdempotencyConflictError, relayer } from "../src/modules/chain/relayer.js";
import { postgresFixture } from "./postgres.mjs";

let fixture;
let chain;
let account;
let now;
let r;
const to = "0x00000000000000000000000000000000000000aa";
const options = () => ({ clock: () => now, baseBackoffMs: 1_000, maxBackoffMs: 8_000, rebroadcastAfterMs: 30_000,
  pollMs: 1_000, maxAttempts: 3 });
const req = (key, data = "0x1234") => ({ idempotencyKey: key, kind: "ticket.markUsed", to, data });
/** Chạy tick tới khi không còn việc đến hạn (tua đồng hồ giữa các vòng). */
async function drain(rounds = 20) {
  for (let i = 0; i < rounds; i++) {
    await r.tick();
    now += 10_000;
  }
}

beforeAll(() => {
  fixture = postgresFixture();
  fixture.run("node_modules/prisma/build/index.js", "migrate", "deploy");
}, 60_000);
beforeEach(async () => {
  await fixture.db.chainTransaction.deleteMany();
  now = Date.UTC(2026, 10, 16);
  chain = new MockChain(43113);
  account = privateKeyToAccount(generatePrivateKey());
  r = relayer(fixture.db, chain, account, options());
});
afterAll(async () => { await fixture?.close(); });

it("dedupes by idempotency key and rejects a reused key with another payload", async () => {
  const a = await r.enqueue(req("markUsed:t1"));
  const b = await r.enqueue(req("markUsed:t1"));
  expect(b.id).toBe(a.id);
  await expect(r.enqueue(req("markUsed:t1", "0xabcd"))).rejects.toBeInstanceOf(IdempotencyConflictError);
  const parallel = await Promise.all(Array.from({ length: 5 }, () => r.enqueue(req("markUsed:t2"))));
  expect(new Set(parallel.map((row) => row.id)).size).toBe(1);
  expect(await fixture.db.chainTransaction.count()).toBe(2);
  await expect(r.enqueue({ ...req("bad key with spaces") })).rejects.toThrow(TypeError);
});

it("signs, sends and confirms exactly one transaction per row", async () => {
  await r.enqueue(req("markUsed:ok"));
  await drain(3);
  const status = await r.status("markUsed:ok");
  expect(status).toMatchObject({ status: "confirmed", nonce: 0, attempts: 0, lastError: null });
  expect(status.txHash).toMatch(/^0x[0-9a-f]{64}$/);
  expect(status).not.toHaveProperty("rawTx");
  expect(chain.mined.size).toBe(1);
  expect(chain.mined.get(status.txHash).from).toBe(account.address.toLowerCase());
});

it("retries network errors with backoff and still sends once", async () => {
  chain.failPrepares = 1;
  chain.failSends = 1;
  await r.enqueue(req("markUsed:retry"));
  await r.tick();
  let row = await fixture.db.chainTransaction.findUniqueOrThrow({ where: { idempotencyKey: "markUsed:retry" } });
  expect(row).toMatchObject({ status: "pending", attempts: 1, lastError: "NETWORK" });
  expect(+row.nextAttemptAt).toBe(now + 1_000);
  await r.tick(); // chưa đến hạn: không làm gì
  expect((await r.status("markUsed:retry")).attempts).toBe(1);
  await drain();
  row = await r.status("markUsed:retry");
  expect(row).toMatchObject({ status: "confirmed", attempts: 2 });
  expect(chain.mined.size).toBe(1);
});

it("treats a lost broadcast ack as sent: resending the same raw tx does not duplicate", async () => {
  chain.loseNextAck = true;
  await r.enqueue(req("markUsed:lost-ack"));
  await drain();
  expect(await r.status("markUsed:lost-ack")).toMatchObject({ status: "confirmed", attempts: 1 });
  expect(chain.mined.size).toBe(1);
});

it("rebroadcasts the same raw tx when it was dropped from the mempool", async () => {
  chain.dropNextSend = true;
  await r.enqueue(req("markUsed:dropped"));
  await r.tick(); // ký
  await r.tick(); // gửi (bị rơi)
  const sent = await r.status("markUsed:dropped");
  expect(sent.status).toBe("submitted");
  await drain();
  const done = await r.status("markUsed:dropped");
  expect(done).toMatchObject({ status: "confirmed", txHash: sent.txHash, nonce: sent.nonce });
  expect(chain.mined.size).toBe(1);
});

it("fails after max attempts and lists the row for reconciliation", async () => {
  chain.failSends = 99;
  await r.enqueue(req("markUsed:dead"));
  await drain();
  const row = await r.status("markUsed:dead");
  expect(row).toMatchObject({ status: "failed", attempts: 3, lastError: "MAX_ATTEMPTS:NETWORK" });
  expect((await r.failed()).map((x) => x.idempotencyKey)).toEqual(["markUsed:dead"]);
  expect(chain.mined.size).toBe(0);
});

it("does not retry a call that would revert", async () => {
  chain.revertWhen = () => true;
  await r.enqueue(req("markUsed:used-ticket"));
  await drain(3);
  expect(await r.status("markUsed:used-ticket")).toMatchObject({ status: "failed", attempts: 0, lastError: "REVERTED", txHash: null });
});

it("assigns sequential nonces, also across parallel workers", async () => {
  for (let i = 0; i < 6; i++) await r.enqueue(req(`markUsed:n${i}`, `0x0${i}`));
  const other = relayer(fixture.db, chain, account, options());
  await Promise.all([r.tick(3), other.tick(6)]);
  const rows = await fixture.db.chainTransaction.findMany({ where: { status: "signed" }, orderBy: { nonce: "asc" } });
  expect(rows.map((x) => x.nonce)).toEqual([0, 1, 2, 3, 4, 5]);
  await drain();
  expect(await fixture.db.chainTransaction.count({ where: { status: "confirmed" } })).toBe(6);
  expect(chain.mined.size).toBe(6);
});

it("rejects inconsistent rows at the database", async () => {
  const row = await r.enqueue(req("markUsed:check"));
  await expect(fixture.db.chainTransaction.update({ where: { id: row.id }, data: { status: "signed" } }))
    .rejects.toThrow(/check constraint|violates/i);
  await expect(fixture.db.chainTransaction.update({ where: { id: row.id }, data: { attempts: 9 } }))
    .rejects.toThrow(/check constraint|violates/i);
  await expect(fixture.db.chainTransaction.update({ where: { id: row.id }, data: { status: "confirmed" } }))
    .rejects.toThrow(/check constraint|violates/i);
});

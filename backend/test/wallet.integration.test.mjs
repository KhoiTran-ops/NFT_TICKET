import { randomBytes, randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildApp } from "../src/index.js";
import { registerAuthRoutes } from "../src/modules/auth/routes.js";
import { custodialWallets } from "../src/modules/wallet/custodial.js";
import { postgresFixture } from "./postgres.mjs";

let fixture;
let now = Date.now();
let app;
const logs = [];
const codes = new Map();
const fieldKey = randomBytes(32);
const cookiesOf = (response) => Object.fromEntries((response.cookies ?? []).map(({ name, value }) => [name, value]));

beforeAll(() => {
  fixture = postgresFixture();
  fixture.run("node_modules/prisma/build/index.js", "migrate", "deploy");
  const stream = new Writable({ write(chunk, _enc, done) { logs.push(chunk.toString()); done(); } });
  app = buildApp({ level: "trace", stream });
  registerAuthRoutes(app, fixture.db, {
    jwtSecret: randomBytes(32), otpPepper: randomBytes(32), fieldKey, clock: () => now,
    deliver: async (email, code) => { codes.set(email, code); },
  });
}, 60_000);
afterAll(async () => {
  await app?.close();
  await fixture?.close();
});

async function login(email) {
  const csrf = await app.inject("/auth/csrf");
  const cookies = cookiesOf(csrf);
  const headers = { "x-csrf-token": csrf.json().csrfToken };
  expect((await app.inject({ method: "POST", url: "/auth/otp/request", payload: { email }, cookies, headers })).statusCode)
    .toBe(202);
  const verified = await app.inject({
    method: "POST", url: "/auth/otp/verify", payload: { email, code: codes.get(email) }, cookies, headers,
  });
  expect(verified.statusCode).toBe(200);
  return verified;
}

it("creates exactly one encrypted custodial wallet on first login", async () => {
  const first = await login("wallet-new@example.test");
  expect(first.json().user.walletLinked).toBe(true);
  const user = await fixture.db.user.findUniqueOrThrow({ where: { email: "wallet-new@example.test" } });
  now += 61_000; // qua giới hạn gửi lại OTP 60 giây
  await login("wallet-new@example.test");

  const rows = await fixture.db.walletLink.findMany({ where: { userId: user.id } });
  expect(rows).toHaveLength(1);
  const [wallet] = rows;
  expect(wallet).toMatchObject({ kind: "custodial", keyVersion: 1, revokedAt: null });
  expect(wallet.address).toMatch(/^0x[0-9a-f]{40}$/);
  expect(wallet.keyCiphertext).toHaveLength(60);

  const signer = await custodialWallets(fieldKey).signer(fixture.db, user.id);
  expect(signer.address.toLowerCase()).toBe(wallet.address);
  const session = await app.inject({ url: "/auth/session", cookies: cookiesOf(first) });
  expect(session.json().user.walletLinked).toBe(true);

  // Không lộ khóa: không có trong body API và log (log mức trace).
  const keyHex = Buffer.from(wallet.keyCiphertext).toString("hex");
  const exposed = [first.body, session.body, ...logs].join("\n");
  expect(exposed).not.toContain(keyHex);
  expect(exposed).not.toContain(Buffer.from(wallet.keyCiphertext).toString("base64"));
  expect(exposed).not.toMatch(/keyCiphertext|privateKey/i);
});

it("enforces one active wallet per user and one account per address", async () => {
  const user = await fixture.db.user.create({ data: { email: `w-${randomUUID()}@example.test`, displayName: "W" } });
  const other = await fixture.db.user.create({ data: { email: `w-${randomUUID()}@example.test`, displayName: "W" } });
  const address = `0x${randomBytes(20).toString("hex")}`;
  const external = (userId, addr = `0x${randomBytes(20).toString("hex")}`) =>
    fixture.db.walletLink.create({ data: { userId, kind: "external", address: addr } });

  await external(user.id, address);
  await expect(external(user.id)).rejects.toThrow(/Unique constraint/);
  await expect(external(other.id, address)).rejects.toThrow(/Unique constraint/);

  // Thu hồi ví cũ thì gắn ví mới được; địa chỉ đã thu hồi vẫn không gắn sang tài khoản khác.
  await fixture.db.walletLink.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
  await external(user.id);
  await expect(external(other.id, address)).rejects.toThrow(/Unique constraint/);
});

it("rejects malformed wallet rows at the database", async () => {
  const user = await fixture.db.user.create({ data: { email: `w-${randomUUID()}@example.test`, displayName: "W" } });
  const base = { userId: user.id, address: `0x${randomBytes(20).toString("hex")}` };
  const check = /check constraint|violates/i;
  await expect(fixture.db.walletLink.create({ data: { ...base, kind: "custodial" } })).rejects.toThrow(check);
  await expect(fixture.db.walletLink.create({
    data: { ...base, kind: "external", keyCiphertext: randomBytes(60), keyVersion: 1 },
  })).rejects.toThrow(check);
  await expect(fixture.db.walletLink.create({
    data: { ...base, kind: "external", address: base.address.toUpperCase().replace("0X", "0x") },
  })).rejects.toThrow(check);
  await expect(fixture.db.walletLink.create({ data: { ...base, kind: "external", address: "0x1234" } }))
    .rejects.toThrow(check);
});

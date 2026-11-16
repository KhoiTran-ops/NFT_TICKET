import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { custodialWallets } from "../src/modules/wallet/custodial.js";

type Row = { userId: string; kind: "custodial" | "external"; address: string; keyCiphertext: Buffer | null;
  keyVersion: number | null; revokedAt: Date | null };

/** Bộ nhớ giả đủ cho các truy vấn của custodialWallets (không cần PostgreSQL). */
function memoryDb() {
  const rows: Row[] = [];
  const match = (row: Row, where: Partial<Row>) =>
    Object.entries(where).every(([k, v]) => row[k as keyof Row] === v);
  const walletLink = {
    async findFirst({ where }: { where: Partial<Row> }) { return rows.find((r) => match(r, where)) ?? null; },
    async create({ data }: { data: Omit<Row, "revokedAt"> }) { const row = { ...data, revokedAt: null }; rows.push(row); return row; },
  };
  return { rows, db: { walletLink } as never };
}

describe("custodialWallets", () => {
  it("rejects an encryption key that is not 32 bytes", () => {
    expect(() => custodialWallets(randomBytes(16))).toThrow("Invalid wallet encryption key");
  });

  it("creates one wallet per user and reuses it", async () => {
    const { rows, db } = memoryDb();
    const wallets = custodialWallets(randomBytes(32));
    const userId = randomUUID();
    const first = await wallets.ensure(db, userId);
    const second = await wallets.ensure(db, userId);
    expect(first).toEqual(second);
    expect(first.kind).toBe("custodial");
    expect(first.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.address).toBe(first.address.toLowerCase());
    expect(rows[0]!.keyVersion).toBe(1);
  });

  it("stores only ciphertext and signs with the stored key", async () => {
    const { rows, db } = memoryDb();
    const wallets = custodialWallets(randomBytes(32));
    const userId = randomUUID();
    const { address } = await wallets.ensure(db, userId);
    const signer = await wallets.signer(db, userId);
    expect(signer?.address).toBe(address);
    // 12 IV + 16 tag + 32 khóa; khóa bản rõ không nằm trong ciphertext.
    const stored = rows[0]!.keyCiphertext!;
    expect(stored).toHaveLength(60);
    const signature = await signer!.signMessage({ message: "ping" });
    expect(signature).toMatch(/^0x[0-9a-f]{130}$/);
    expect(JSON.stringify(await wallets.active(db, userId))).not.toMatch(/key|cipher/i);
  });

  it("refuses ciphertext under a different key or bound to a different user", async () => {
    const { rows, db } = memoryDb();
    const fieldKey = randomBytes(32);
    const userId = randomUUID();
    await custodialWallets(fieldKey).ensure(db, userId);
    await expect(custodialWallets(randomBytes(32)).signer(db, userId)).rejects.toThrow();
    // Chép ciphertext sang user khác: AAD không khớp → giải mã thất bại.
    const other = randomUUID();
    rows.push({ ...rows[0]!, userId: other });
    rows[0]!.revokedAt = new Date();
    await expect(custodialWallets(fieldKey).signer(db, other)).rejects.toThrow();
  });

  it("returns no signer for users without an active custodial wallet", async () => {
    const { rows, db } = memoryDb();
    const wallets = custodialWallets(randomBytes(32));
    expect(await wallets.signer(db, randomUUID())).toBeUndefined();
    rows.push({ userId: "ext", kind: "external", address: "0x" + "ab".repeat(20), keyCiphertext: null,
      keyVersion: null, revokedAt: null });
    expect(await wallets.signer(db, "ext")).toBeUndefined();
    expect(await wallets.active(db, "ext")).toEqual({ kind: "external", address: expect.stringMatching(/^0x/) });
  });
});

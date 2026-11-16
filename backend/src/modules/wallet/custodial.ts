import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getAddress, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

/**
 * Ví custodial (TIC-57, PRODUCT_CONTEXT 5.3). CHỈ cho MVP/testnet.
 *
 * - Khóa riêng sinh ngẫu nhiên, mã hóa AES-256-GCM trước khi lưu. Khóa mã hóa là khóa con HKDF của
 *   FIELD_ENCRYPTION_KEY (tách khỏi khóa dùng cho TOTP). AAD gắn userId + địa chỉ, nên không chép
 *   ciphertext sang tài khoản/ví khác được.
 * - Khóa riêng không bao giờ được trả qua API, ghi log hoặc đưa vào lỗi. Chỉ `signer()` giải mã,
 *   dùng nội bộ cho relayer (TIC-58).
 */
export const CUSTODIAL_KEY_VERSION = 1;
const HKDF_INFO = "nft-ticket/custodial-wallet/v1";

export type WalletView = { address: Address; kind: "custodial" | "external" };

export function custodialWallets(fieldKey: Buffer) {
  if (fieldKey.length !== 32) throw new Error("Invalid wallet encryption key");
  const key = Buffer.from(hkdfSync("sha256", fieldKey, Buffer.alloc(0), HKDF_INFO, 32));
  const aad = (userId: string, address: string) => Buffer.from(`wallet:v${CUSTODIAL_KEY_VERSION}:${userId}:${address}`);

  function seal(privateKey: Hex, userId: string, address: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv).setAAD(aad(userId, address));
    const plain = Buffer.from(privateKey.slice(2), "hex");
    const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
    plain.fill(0);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
  }

  function open(value: Uint8Array, userId: string, address: string): Hex {
    const data = Buffer.from(value);
    const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12))
      .setAAD(aad(userId, address)).setAuthTag(data.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]);
    const hex = `0x${plain.toString("hex")}` as Hex;
    plain.fill(0);
    return hex;
  }

  return {
    /**
     * Bảo đảm user có một ví nhận vé đang hoạt động; chưa có thì tạo ví custodial.
     * Gọi trong transaction đăng nhập (đã khóa hàng User), nên không tạo trùng.
     */
    async ensure(tx: Prisma.TransactionClient, userId: string): Promise<WalletView> {
      const active = await tx.walletLink.findFirst({
        where: { userId, revokedAt: null }, select: { address: true, kind: true },
      });
      if (active) return { address: getAddress(active.address), kind: active.kind };

      const privateKey = generatePrivateKey();
      const address = privateKeyToAccount(privateKey).address.toLowerCase();
      await tx.walletLink.create({
        data: {
          userId, kind: "custodial", address,
          keyCiphertext: seal(privateKey, userId, address), keyVersion: CUSTODIAL_KEY_VERSION,
        },
      });
      return { address: getAddress(address), kind: "custodial" };
    },

    /** Ví đang hoạt động của user (không có khóa). */
    async active(db: PrismaClient | Prisma.TransactionClient, userId: string): Promise<WalletView | undefined> {
      const wallet = await db.walletLink.findFirst({
        where: { userId, revokedAt: null }, select: { address: true, kind: true },
      });
      return wallet ? { address: getAddress(wallet.address), kind: wallet.kind } : undefined;
    },

    /**
     * Account ký giao dịch cho ví custodial đang hoạt động. Chỉ dùng nội bộ (relayer).
     * Trả `undefined` nếu user không có ví custodial hoạt động.
     */
    async signer(db: PrismaClient | Prisma.TransactionClient, userId: string): Promise<PrivateKeyAccount | undefined> {
      const wallet = await db.walletLink.findFirst({
        where: { userId, revokedAt: null, kind: "custodial" },
        select: { address: true, keyCiphertext: true, keyVersion: true },
      });
      if (!wallet?.keyCiphertext || wallet.keyVersion !== CUSTODIAL_KEY_VERSION) return undefined;
      const account = privateKeyToAccount(open(wallet.keyCiphertext, userId, wallet.address));
      if (account.address.toLowerCase() !== wallet.address) throw new Error("Custodial wallet integrity check failed");
      return account;
    },
  };
}

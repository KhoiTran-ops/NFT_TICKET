BEGIN;

-- Ví nhận vé của người dùng (PRODUCT_CONTEXT 5.3, D-007 đang "Đề xuất").
CREATE TYPE "WalletKind" AS ENUM ('custodial', 'external');

CREATE TABLE "WalletLink" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "WalletKind" NOT NULL,
    "address" VARCHAR(42) NOT NULL,
    "keyCiphertext" BYTEA,
    "keyVersion" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "WalletLink_pkey" PRIMARY KEY ("id"),
    -- Địa chỉ lưu dạng chữ thường để so sánh duy nhất; API trả dạng checksum.
    CONSTRAINT "WalletLink_address_format" CHECK ("address" ~ '^0x[0-9a-f]{40}$'),
    -- Chỉ ví custodial có khóa (đã mã hóa); ví ngoài không bao giờ lưu khóa.
    CONSTRAINT "WalletLink_custodial_key" CHECK (
        ("kind" = 'custodial') = ("keyCiphertext" IS NOT NULL AND "keyVersion" IS NOT NULL)
    ),
    CONSTRAINT "WalletLink_revoked_after_created" CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt")
);

-- Một địa chỉ ví chỉ gắn một tài khoản, kể cả khi đã thu hồi.
CREATE UNIQUE INDEX "WalletLink_address_key" ON "WalletLink"("address");
CREATE INDEX "WalletLink_userId_idx" ON "WalletLink"("userId");
-- Mỗi tài khoản có đúng một ví nhận vé đang hoạt động.
CREATE UNIQUE INDEX "WalletLink_userId_active_key" ON "WalletLink"("userId") WHERE "revokedAt" IS NULL;

ALTER TABLE "WalletLink" ADD CONSTRAINT "WalletLink_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

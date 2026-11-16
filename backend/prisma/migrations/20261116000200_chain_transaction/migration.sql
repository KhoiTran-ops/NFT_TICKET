BEGIN;

-- Hàng đợi giao dịch của relayer (TIC-58). Một hàng = một thao tác on-chain, chống lặp theo idempotencyKey.
CREATE TYPE "ChainTxStatus" AS ENUM ('pending', 'signed', 'submitted', 'confirmed', 'failed');

CREATE TABLE "ChainTransaction" (
    "id" UUID NOT NULL,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "kind" VARCHAR(64) NOT NULL,
    "chainId" INTEGER NOT NULL,
    "fromAddress" VARCHAR(42) NOT NULL,
    "toAddress" VARCHAR(42) NOT NULL,
    "data" BYTEA NOT NULL,
    "status" "ChainTxStatus" NOT NULL DEFAULT 'pending',
    "nonce" INTEGER,
    "rawTx" BYTEA,
    "txHash" VARCHAR(66),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" VARCHAR(64),
    "blockNumber" BIGINT,
    "submittedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ChainTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChainTransaction_address_format" CHECK (
        "fromAddress" ~ '^0x[0-9a-f]{40}$' AND "toAddress" ~ '^0x[0-9a-f]{40}$'
    ),
    CONSTRAINT "ChainTransaction_hash_format" CHECK ("txHash" IS NULL OR "txHash" ~ '^0x[0-9a-f]{64}$'),
    CONSTRAINT "ChainTransaction_attempts" CHECK ("attempts" >= 0 AND "maxAttempts" > 0 AND "attempts" <= "maxAttempts"),
    -- Đã ký thì phải có nonce + raw + hash; chưa ký thì chưa có gì.
    CONSTRAINT "ChainTransaction_signed_fields" CHECK (
        ("status" = 'pending' AND "nonce" IS NULL AND "rawTx" IS NULL AND "txHash" IS NULL)
        OR ("status" IN ('signed', 'submitted', 'confirmed') AND "nonce" IS NOT NULL AND "rawTx" IS NOT NULL AND "txHash" IS NOT NULL)
        OR "status" = 'failed'
    ),
    CONSTRAINT "ChainTransaction_confirmed_fields" CHECK (
        ("status" = 'confirmed') = ("confirmedAt" IS NOT NULL AND "blockNumber" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "ChainTransaction_idempotencyKey_key" ON "ChainTransaction"("idempotencyKey");
CREATE UNIQUE INDEX "ChainTransaction_txHash_key" ON "ChainTransaction"("txHash");
CREATE INDEX "ChainTransaction_status_nextAttemptAt_idx" ON "ChainTransaction"("status", "nextAttemptAt");
CREATE INDEX "ChainTransaction_chainId_fromAddress_nonce_idx" ON "ChainTransaction"("chainId", "fromAddress", "nonce");

COMMIT;

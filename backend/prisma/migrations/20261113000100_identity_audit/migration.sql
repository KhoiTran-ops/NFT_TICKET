-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

BEGIN;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'org_owner', 'org_manager', 'gate_staff', 'platform_operator', 'kyc_reviewer', 'platform_admin');

-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('email', 'sms');

-- CreateEnum
CREATE TYPE "VerificationLevel" AS ENUM ('L1', 'L2', 'L3');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('not_started', 'pending', 'verified', 'rejected', 'revoked');

-- CreateEnum
CREATE TYPE "KycReasonCode" AS ENUM ('DOC_UNREADABLE', 'DOC_EXPIRED', 'DOC_NOT_SUPPORTED', 'FACE_MISMATCH', 'LIVENESS_FAILED', 'DUPLICATE_IDENTITY', 'UNDERAGE', 'PROVIDER_ERROR');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('user', 'system');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "phone" VARCHAR(16),
    "phoneVerifiedAt" TIMESTAMPTZ(3),
    "displayName" TEXT NOT NULL,
    "lockedUntil" TIMESTAMPTZ(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "totpSecretCiphertext" BYTEA,
    "totpEnabledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "refreshTokenHash" BYTEA NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "rotatedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "mfaVerifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" UUID NOT NULL,
    "channel" "OtpChannel" NOT NULL,
    "targetHash" BYTEA NOT NULL,
    "codeHash" BYTEA NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'user',
    "actorId" UUID,
    "role" "Role",
    "systemActor" VARCHAR(64),
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT NOT NULL,
    "ip" INET,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycVerification" (
    "userId" UUID NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'not_started',
    "level" "VerificationLevel" NOT NULL DEFAULT 'L1',
    "providerRef" TEXT,
    "idNumberHash" BYTEA,
    "legalNameCiphertext" BYTEA,
    "birthDateCiphertext" BYTEA,
    "idLastFourCiphertext" BYTEA,
    "documentExpiryCiphertext" BYTEA,
    "verifiedAt" TIMESTAMPTZ(3),
    "reasonCode" "KycReasonCode",

    CONSTRAINT "KycVerification_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

-- CreateIndex
CREATE INDEX "OtpChallenge_channel_targetHash_createdAt_idx" ON "OtpChallenge"("channel", "targetHash", "createdAt");

-- CreateIndex
CREATE INDEX "OtpChallenge_expiresAt_idx" ON "OtpChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_id_idx" ON "AuditLog"("createdAt", "id");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "KycVerification_providerRef_key" ON "KycVerification"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "KycVerification_idNumberHash_key" ON "KycVerification"("idNumberHash");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycVerification" ADD CONSTRAINT "KycVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_identity_check" CHECK (
    "email" = lower(btrim("email")) AND "email" <> ''
    AND ("phone" IS NULL OR "phone" ~ '^[+][1-9][0-9]{7,14}$')
    AND ("phoneVerifiedAt" IS NULL OR "phone" IS NOT NULL)
    AND ("totpEnabledAt" IS NULL OR "totpSecretCiphertext" IS NOT NULL)
    AND "sessionVersion" >= 0
);
ALTER TABLE "Session" ADD CONSTRAINT "Session_hash_expiry_check" CHECK (
    octet_length("refreshTokenHash") = 32 AND "expiresAt" > "createdAt"
);
ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_hash_expiry_check" CHECK (
    octet_length("targetHash") = 32 AND octet_length("codeHash") = 32
    AND "attempts" BETWEEN 0 AND 5 AND "expiresAt" > "createdAt"
);
ALTER TABLE "KycVerification" ADD CONSTRAINT "KycVerification_hash_check" CHECK (
    "idNumberHash" IS NULL OR octet_length("idNumberHash") = 32
);

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actor_check" CHECK (
    ("actorType" = 'user' AND "actorId" IS NOT NULL AND "role" IS NOT NULL
        AND "ip" IS NOT NULL AND "systemActor" IS NULL)
    OR ("actorType" = 'system' AND "actorId" IS NULL AND "role" IS NULL
        AND "systemActor" IS NOT NULL AND "systemActor" ~ '^[a-z][a-z0-9_-]{0,63}$')
);

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_reason_check" CHECK (btrim("reason") <> '');
CREATE FUNCTION reject_audit_log_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'AuditLog is append-only';
END;
$$;
CREATE TRIGGER audit_log_append_only
    BEFORE UPDATE OR DELETE OR TRUNCATE ON "AuditLog"
    FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_log_mutation();

COMMIT;

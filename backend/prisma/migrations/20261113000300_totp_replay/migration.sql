ALTER TABLE "User"
    ADD COLUMN "totpLastCounter" BIGINT,
    ADD COLUMN "totpFailedAttempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "totpLockedUntil" TIMESTAMPTZ(3),
    ADD CONSTRAINT "User_totp_attempts_check" CHECK ("totpFailedAttempts" BETWEEN 0 AND 5);

BEGIN;

ALTER TABLE "Session" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Existing sessions predate versioned tokens. Require a fresh login.
UPDATE "Session" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "revokedAt" IS NULL;

COMMIT;

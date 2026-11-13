BEGIN;

-- CreateEnum
CREATE TYPE "KybStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft', 'published', 'cancel_requested', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('reserved', 'paid', 'issued', 'expired', 'payment_failed', 'exception');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('active', 'listed', 'settling', 'used', 'void_pending_refund', 'void');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('VND');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('platform', 'organization', 'event');

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "organizationId" UUID,
    "eventId" UUID,
    "grantedById" UUID,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "legalName" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "kybStatus" "KybStatus" NOT NULL DEFAULT 'pending',
    "issuerAddress" VARCHAR(42),
    "payoutAccountCiphertext" BYTEA,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "venue" TEXT,
    "timezone" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'draft',
    "kycRequired" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "perAccountLimit" INTEGER,
    "chainId" INTEGER,
    "registryAddress" VARCHAR(42),
    "onChainEventId" DECIMAL(78,0),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTier" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "faceValue" BIGINT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'VND',
    "quantity" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "saleStartsAt" TIMESTAMPTZ(3) NOT NULL,
    "saleEndsAt" TIMESTAMPTZ(3) NOT NULL,
    "perAccountLimit" INTEGER NOT NULL,

    CONSTRAINT "TicketTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tierId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'reserved',
    "quantity" INTEGER NOT NULL,
    "unitPrice" BIGINT NOT NULL,
    "fee" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'VND',
    "policyVersion" TEXT NOT NULL,
    "policyAcceptedAt" TIMESTAMPTZ(3) NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" BYTEA NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "faceValue" BIGINT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'active',
    "chainId" INTEGER NOT NULL,
    "registryAddress" VARCHAR(42) NOT NULL,
    "tokenId" DECIMAL(78,0) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleAssignment_userId_idx" ON "RoleAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_taxId_key" ON "Organization"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_issuerAddress_key" ON "Organization"("issuerAddress");

-- CreateIndex
CREATE INDEX "Event_organizationId_idx" ON "Event"("organizationId");

-- CreateIndex
CREATE INDEX "Event_status_startsAt_id_idx" ON "Event"("status", "startsAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Event_chainId_registryAddress_onChainEventId_key" ON "Event"("chainId", "registryAddress", "onChainEventId");

-- CreateIndex
CREATE INDEX "TicketTier_eventId_idx" ON "TicketTier"("eventId");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_id_idx" ON "Order"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Order_tierId_userId_status_idx" ON "Order"("tierId", "userId", "status");

-- CreateIndex
CREATE INDEX "Order_status_expiresAt_idx" ON "Order"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key" ON "Order"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Ticket_ownerId_status_idx" ON "Ticket"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Ticket_orderId_idx" ON "Ticket"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_chainId_registryAddress_tokenId_key" ON "Ticket"("chainId", "registryAddress", "tokenId");

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTier" ADD CONSTRAINT "TicketTier_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "TicketTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce role/scope combinations even when a writer bypasses the API.
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_scope_check" CHECK (
    ("scopeType" = 'platform' AND "role" IN ('user', 'platform_operator', 'kyc_reviewer', 'platform_admin')
        AND "organizationId" IS NULL AND "eventId" IS NULL)
    OR ("scopeType" = 'organization' AND "role" IN ('org_owner', 'org_manager')
        AND "organizationId" IS NOT NULL AND "eventId" IS NULL)
    OR ("scopeType" = 'event' AND "role" = 'gate_staff'
        AND "organizationId" IS NULL AND "eventId" IS NOT NULL AND "expiresAt" IS NOT NULL)
);
CREATE UNIQUE INDEX "RoleAssignment_platform_key" ON "RoleAssignment" ("userId", "role") WHERE "scopeType" = 'platform';
CREATE UNIQUE INDEX "RoleAssignment_organization_key" ON "RoleAssignment" ("userId", "role", "organizationId") WHERE "scopeType" = 'organization';
CREATE UNIQUE INDEX "RoleAssignment_event_key" ON "RoleAssignment" ("userId", "role", "eventId") WHERE "scopeType" = 'event';

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_issuer_address_check" CHECK (
    "issuerAddress" IS NULL OR "issuerAddress" ~ '^0x[0-9a-f]{40}$'
);

ALTER TABLE "Event" ADD CONSTRAINT "Event_bounds_check" CHECK (
    "endsAt" > "startsAt" AND ("perAccountLimit" IS NULL OR "perAccountLimit" > 0)
);
ALTER TABLE "Event" ADD CONSTRAINT "Event_chain_identity_check" CHECK (
    num_nonnulls("chainId", "registryAddress", "onChainEventId") = 0
    OR (num_nonnulls("chainId", "registryAddress", "onChainEventId") = 3
        AND "chainId" > 0 AND "registryAddress" ~ '^0x[0-9a-f]{40}$'
        AND "onChainEventId" BETWEEN 0 AND 115792089237316195423570985008687907853269984665640564039457584007913129639935)
);
ALTER TABLE "TicketTier" ADD CONSTRAINT "TicketTier_bounds_check" CHECK (
    "faceValue" >= 0 AND "quantity" > 0 AND "reserved" >= 0 AND "sold" >= 0
    AND "reserved"::bigint + "sold" <= "quantity"
    AND "saleEndsAt" > "saleStartsAt" AND "perAccountLimit" > 0
);
ALTER TABLE "Order" ADD CONSTRAINT "Order_snapshot_check" CHECK (
    "quantity" > 0 AND "unitPrice" >= 0 AND "fee" >= 0
    AND "total" = "unitPrice"::numeric * "quantity" + "fee"
    AND octet_length("requestHash") = 32 AND "expiresAt" > "createdAt"
);
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_chain_identity_check" CHECK (
    "faceValue" >= 0 AND "chainId" > 0 AND "registryAddress" ~ '^0x[0-9a-f]{40}$'
    AND "tokenId" BETWEEN 0 AND 115792089237316195423570985008687907853269984665640564039457584007913129639935
);

COMMIT;

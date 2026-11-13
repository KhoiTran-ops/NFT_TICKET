import { PrismaClient } from "@prisma/client";

const url = new URL(process.env.DATABASE_URL ?? "invalid:");
if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEMO_SEED !== "true"
  || !["postgresql:", "postgres:"].includes(url.protocol)
  || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
  throw new Error("Demo seed requires ALLOW_DEMO_SEED=true and a local development database");
}

const db = new PrismaClient();
const orgId = "12ab0000-0000-4000-8000-000000000001";
const eventId = "12ab0000-0000-4000-8000-000000000002";
const tierId = "12ab0000-0000-4000-8000-000000000003";

try {
  await db.$transaction([
    db.organization.upsert({
      where: { id: orgId },
      update: {},
      create: { id: orgId, legalName: "Encore Demo", taxId: "demo-encore" },
    }),
    db.event.upsert({
      where: { id: eventId },
      update: {},
      create: {
        id: eventId, organizationId: orgId, name: "Encore Demo Concert",
        timezone: "Asia/Ho_Chi_Minh", policyVersion: "demo-v1",
        startsAt: new Date("2030-11-21T12:00:00Z"), endsAt: new Date("2030-11-21T15:00:00Z"),
      },
    }),
    db.ticketTier.upsert({
      where: { id: tierId },
      update: {},
      create: {
        id: tierId, eventId, name: "Demo General Admission",
        faceValue: 250_000n, quantity: 50, perAccountLimit: 4,
        saleStartsAt: new Date("2030-11-01T02:00:00Z"), saleEndsAt: new Date("2030-11-21T11:00:00Z"),
      },
    }),
  ]);
} finally {
  await db.$disconnect();
}

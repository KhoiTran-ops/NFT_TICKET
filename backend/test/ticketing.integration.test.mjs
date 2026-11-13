import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { postgresFixture } from "./postgres.mjs";

let fixture;
let db;
let userId;
const tierId = "12ab0000-0000-4000-8000-000000000003";
const eventId = "12ab0000-0000-4000-8000-000000000002";

beforeAll(async () => {
  fixture = postgresFixture();
  db = fixture.db;
  fixture.run("node_modules/prisma/build/index.js", "migrate", "deploy");
  fixture.run("prisma/seed.mjs");
  fixture.run("prisma/seed.mjs");
  const user = await db.user.create({ data: { email: "buyer@example.test", displayName: "Test Buyer" } });
  userId = user.id;
}, 60_000);
afterAll(async () => fixture?.close());

it("seeds one draft event and a tier after two runs", async () => {
  expect(await db.organization.count()).toBe(1);
  expect(await db.ticketTier.count()).toBe(1);
  expect(await db.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({
    status: "draft", chainId: null, onChainEventId: null,
  });
  expect(await db.roleAssignment.count()).toBe(0);
});

it("rejects scope escalation and duplicate grants", async () => {
  await expect(db.roleAssignment.create({
    data: { userId, role: "gate_staff", scopeType: "platform" },
  })).rejects.toThrow("RoleAssignment_scope_check");
  await expect(db.roleAssignment.create({
    data: { userId, role: "gate_staff", scopeType: "event", eventId },
  })).rejects.toThrow("RoleAssignment_scope_check");
  const data = { userId, role: "user", scopeType: "platform" };
  await db.roleAssignment.create({ data });
  await expect(db.roleAssignment.create({ data })).rejects.toMatchObject({ code: "P2002" });
  const eventRole = {
    userId, role: "gate_staff", scopeType: "event", eventId,
    expiresAt: new Date(Date.now() + 60_000),
  };
  await db.roleAssignment.create({ data: eventRole });
  await expect(db.roleAssignment.create({ data: eventRole })).rejects.toMatchObject({ code: "P2002" });
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
  const orgRole = { userId, role: "org_owner", scopeType: "organization", organizationId: event.organizationId };
  await db.roleAssignment.create({ data: orgRole });
  await expect(db.roleAssignment.create({ data: orgRole })).rejects.toMatchObject({ code: "P2002" });
});

it("rejects excess inventory and inconsistent or repeated orders", async () => {
  await expect(db.ticketTier.update({
    where: { id: tierId }, data: { reserved: 51 },
  })).rejects.toThrow("TicketTier_bounds_check");
  const data = {
    userId, tierId, quantity: 1, unitPrice: 250_000n, total: 250_000n,
    policyVersion: "demo-v1", policyAcceptedAt: new Date(), idempotencyKey: randomUUID(),
    requestHash: new Uint8Array(32), expiresAt: new Date(Date.now() + 60_000),
  };
  await expect(db.order.create({ data: { ...data, total: 249_999n } })).rejects.toThrow("Order_snapshot_check");
  const order = await db.order.create({ data });
  await expect(db.order.create({ data })).rejects.toMatchObject({ code: "P2002" });

  const ticket = {
    orderId: order.id, ownerId: userId, chainId: 43113,
    registryAddress: "0x" + "a".repeat(40),
    tokenId: ((1n << 256n) - 1n).toString(), faceValue: 250_000n,
  };
  const created = await db.ticket.create({ data: ticket });
  expect(created.tokenId.toFixed()).toBe(ticket.tokenId);
  await expect(db.ticket.create({ data: ticket })).rejects.toMatchObject({ code: "P2002" });
  await expect(db.ticket.create({
    data: { ...ticket, tokenId: (1n << 256n).toString() },
  })).rejects.toThrow("Ticket_chain_identity_check");
});

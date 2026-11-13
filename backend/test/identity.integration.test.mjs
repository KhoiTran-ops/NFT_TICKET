import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { postgresFixture } from "./postgres.mjs";

let fixture;
beforeAll(() => {
  fixture = postgresFixture();
  fixture.run("node_modules/prisma/build/index.js", "migrate", "deploy");
}, 60_000);
afterAll(async () => fixture?.close());

it("records user and system actions with the appropriate actor fields", async () => {
  const { db } = fixture;
  const user = await db.user.create({ data: { email: "audit@example.test", displayName: "Audit fixture" } });
  const base = {
    action: "fixture", targetType: "event", targetId: randomUUID(),
    reason: "Test audit persistence", correlationId: randomUUID(),
  };
  const system = { ...base, actorType: "system", systemActor: "auction-close" };
  const entry = await db.auditLog.create({ data: system });
  expect(entry).toMatchObject({ actorId: null, ip: null, role: null, systemActor: "auction-close" });
  const person = { ...base, actorId: user.id, role: "platform_admin", ip: "192.0.2.1" };
  await expect(db.auditLog.create({ data: person })).resolves.toMatchObject({ actorType: "user" });
  await expect(db.auditLog.create({ data: { ...system, systemActor: null } })).rejects.toThrow("AuditLog_actor_check");
  await expect(db.auditLog.create({ data: { ...system, actorId: user.id } })).rejects.toThrow("AuditLog_actor_check");
  await expect(db.auditLog.create({ data: { ...person, ip: null } })).rejects.toThrow("AuditLog_actor_check");

  const where = { id: entry.id };
  await expect(db.auditLog.update({ where, data: { reason: "changed" } })).rejects.toThrow("AuditLog is append-only");
  await expect(db.auditLog.delete({ where })).rejects.toThrow("AuditLog is append-only");
  await expect(db.$executeRaw`TRUNCATE TABLE "AuditLog"`).rejects.toThrow("AuditLog is append-only");
});

import { afterAll, beforeAll, expect, it } from "vitest";
import { postgresFixture } from "./postgres.mjs";
import { buildApp } from "../src/index.js";
import { registerPublicEventRoutes } from "../src/modules/events/public-events.js";

let fixture;
let db;
const tierId = "12ab0000-0000-4000-8000-000000000003";
const eventId = "12ab0000-0000-4000-8000-000000000002";

beforeAll(() => {
  fixture = postgresFixture();
  db = fixture.db;
  fixture.run("node_modules/prisma/build/index.js", "migrate", "deploy");
  fixture.run("prisma/seed.mjs");
}, 60_000);
afterAll(async () => fixture?.close());

it("exposes only public events, paginates ties and returns public tier data", async () => {
  const app = buildApp(false);
  registerPublicEventRoutes(app, db);
  try {
    const draft = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    expect((await app.inject(`/events/${eventId}`)).statusCode).toBe(404);
    expect((await app.inject("/events/not-a-uuid")).statusCode).toBe(404);
    expect((await app.inject("/events?limit=0")).statusCode).toBe(400);
    expect((await app.inject("/events?cursor=invalid")).statusCode).toBe(400);
    expect((await app.inject("/events")).json()).toEqual({ items: [], nextCursor: null });
    const publicId = "12ab0000-0000-4000-8000-000000000004";
    const cancelledId = "12ab0000-0000-4000-8000-000000000005";
    await db.event.update({ where: { id: eventId }, data: { status: "published" } });
    await db.event.createMany({ data: [
      { ...draft, id: publicId, status: "published" },
      { ...draft, id: cancelledId, status: "cancelled" },
    ] });
    const page = (await app.inject("/events?limit=1")).json();
    expect(page.items.map(({ id }) => id)).toEqual([eventId]);
    expect(page.nextCursor).toBeTruthy();
    const next = (await app.inject(`/events?limit=1&cursor=${page.nextCursor}`)).json();
    expect(next.items.map(({ id }) => id)).toEqual([publicId]);
    expect(next.nextCursor).toBeNull();
    const detail = (await app.inject(`/events/${eventId}`)).json();
    expect(detail).toMatchObject({
      id: eventId, policyVersion: "demo-v1",
      tiers: [{ id: tierId, basePrice: 250_000, totalQuantity: 50, availableQuantity: 50 }],
    });
    expect(detail).not.toHaveProperty("registryAddress");
    expect(detail.tiers[0]).not.toHaveProperty("reserved");
    expect((await app.inject(`/events/${cancelledId}`)).json().status).toBe("cancelled");
  } finally {
    await app.close();
  }
});

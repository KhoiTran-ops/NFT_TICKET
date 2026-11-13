import { expect, it, vi } from "vitest";
import { buildApp } from "../src/index.js";
import { registerPublicEventRoutes } from "../src/modules/events/public-events.js";

it("rate limits only the event list and ignores untrusted forwarded IPs", async () => {
  const app = buildApp(false);
  const db = { event: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) } };
  registerPublicEventRoutes(app, db);
  try {
    for (let i = 0; i < 60; i++) {
      expect((await app.inject("/events")).statusCode).toBe(200);
    }
    const limited = await app.inject({ url: "/events", headers: { "x-forwarded-for": "192.0.2.2" } });
    expect(limited.statusCode).toBe(429);
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect(limited.json()).toMatchObject({ code: "RATE_LIMITED", correlationId: limited.headers["x-request-id"] });
    expect(db.event.findMany).toHaveBeenCalledTimes(60);
    expect((await app.inject({ url: "/events", remoteAddress: "192.0.2.2" })).statusCode).toBe(200);
    expect((await app.inject("/events/12ab0000-0000-4000-8000-000000000002")).statusCode).toBe(404);
  } finally {
    await app.close();
  }
});

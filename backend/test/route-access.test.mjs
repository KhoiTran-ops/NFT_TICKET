import { randomBytes } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { buildApp } from "../src/index.js";
import { registerAuthRoutes } from "../src/modules/auth/routes.js";
import { registerEventManagement } from "../src/modules/events/manage.js";
import { registerPublicEventRoutes } from "../src/modules/events/public-events.js";

// Routes reachable without a session. Adding one must be a deliberate change to this list.
// `GET /health` is registered inside buildApp before this hook and is covered by app.test.ts.
const PUBLIC_ROUTES = [
  "GET /auth/csrf",
  "GET /events",
  "GET /events/:eventId",
  "POST /auth/otp/request",
  "POST /auth/otp/verify",
];

let app;
afterEach(async () => app?.close());

async function fullApp() {
  app = buildApp(false);
  const routes = [];
  app.addHook("onRoute", ({ method, url, config }) => {
    for (const m of [method].flat()) routes.push({ key: `${m} ${url}`, config: config ?? {} });
  });
  const db = {};
  registerAuthRoutes(app, db, {
    jwtSecret: randomBytes(32), otpPepper: randomBytes(32), fieldKey: randomBytes(32),
    deliver: async () => { throw new Error("must not send"); },
  }, (scope, access) => {
    registerPublicEventRoutes(scope, db, access);
    registerEventManagement(scope, db, access);
  });
  await app.ready();
  return routes;
}

it("declares access for every route and keeps the public list explicit", async () => {
  const routes = await fullApp();
  const undeclared = routes.filter(({ config }) => config.public !== true && typeof config.authenticate !== "function");
  expect(undeclared.map(({ key }) => key)).toEqual([]);
  const open = routes.filter(({ config }) => config.public === true).map(({ key }) => key).sort();
  expect(open).toEqual([...PUBLIC_ROUTES].sort());
});

it("checks the session before parsing or validating the body", async () => {
  await fullApp();
  const response = await app.inject({
    method: "POST", url: "/organizations/12ab0000-0000-4000-8000-000000000001/events",
    headers: { "content-type": "application/json" }, payload: "{",
  });
  expect(response.statusCode).toBe(401);
  expect(response.json()).toMatchObject({ code: "AUTH_REQUIRED" });
});

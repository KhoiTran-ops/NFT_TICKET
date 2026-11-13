import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { URI } from "otpauth";
import { buildApp } from "../src/index.js";
import { registerAuthRoutes } from "../src/modules/auth/routes.js";
import { postgresFixture } from "./postgres.mjs";

let fixture;
let app;
let now;
const codes = new Map();
const tokenCookies = (response) => Object.fromEntries(
  (response.cookies ?? []).map(({ name, value }) => [name, value]),
);

beforeAll(() => {
  fixture = postgresFixture();
  fixture.run("node_modules/prisma/build/index.js", "migrate", "deploy");
  app = buildApp(false);
  registerAuthRoutes(app, fixture.db, {
    jwtSecret: randomBytes(32), otpPepper: randomBytes(32), fieldKey: randomBytes(32), clock: () => now,
    deliver: async (email, code) => { codes.set(email, code); },
  });
}, 60_000);
beforeEach(() => { now = Date.now(); });
afterAll(async () => {
  await app?.close();
  await fixture?.close();
});

async function browser() {
  const response = await app.inject("/auth/csrf");
  expect(response.statusCode).toBe(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  const cookies = tokenCookies(response);
  const headers = { "x-csrf-token": response.json().csrfToken };
  return {
    post: (url, payload, session = {}) => app.inject({
      method: "POST", url, payload, cookies: { ...cookies, ...session }, headers,
    }),
    get: (session) => app.inject({ url: "/auth/session", cookies: session }),
    read: (url, session) => app.inject({ url, cookies: session }),
  };
}

async function login(client, email) {
  expect((await client.post("/auth/otp/request", { email })).statusCode).toBe(202);
  const result = await client.post("/auth/otp/verify", { email, code: codes.get(email) });
  expect(result.statusCode).toBe(200);
  return result;
}

it("serializes OTP sends and consumption and rejects missing CSRF", async () => {
  const email = "concurrent@example.test";
  const client = await browser();
  expect((await app.inject({ method: "POST", url: "/auth/otp/request", payload: { email } })).json().code)
    .toBe("CSRF_INVALID");
  const sends = await Promise.all(Array.from({ length: 2 }, () => client.post("/auth/otp/request", { email })));
  expect(sends.map((r) => r.statusCode).sort()).toEqual([202, 429]);
  const attempts = await Promise.all(Array.from({ length: 2 }, () =>
    client.post("/auth/otp/verify", { email, code: codes.get(email) })));
  expect(attempts.map((r) => r.statusCode).sort()).toEqual([200, 400]);
  const accepted = attempts.find((r) => r.statusCode === 200);
  expect(accepted.json()).toMatchObject({ verificationLevel: "L1", roles: [{ role: "user" }] });
  expect(accepted.json().user).not.toHaveProperty("email");
  for (const value of accepted.cookies) {
    expect(value).toMatchObject({ secure: true, httpOnly: true, sameSite: "Lax" });
  }
});

it("expires OTPs, locks after five mistakes and limits sends per hour", async () => {
  const email = "limits@example.test";
  const client = await browser();
  expect((await client.post("/auth/otp/request", { email })).statusCode).toBe(202);
  now += 5 * 60_000;
  expect((await client.post("/auth/otp/verify", { email, code: codes.get(email) })).json().code).toBe("OTP_INVALID");
  expect((await client.post("/auth/otp/request", { email })).statusCode).toBe(202);
  const badCode = codes.get(email) === "000000" ? "111111" : "000000";
  for (let i = 0; i < 4; i++) {
    expect((await client.post("/auth/otp/verify", { email, code: badCode })).json().code).toBe("OTP_INVALID");
  }
  const locked = await client.post("/auth/otp/verify", { email, code: badCode });
  expect(locked.statusCode).toBe(429);
  expect(locked.json().code).toBe("OTP_LOCKED");
  expect(locked.headers["retry-after"]).toBe("900");
  expect((await client.post("/auth/otp/request", { email })).statusCode).toBe(429);
  now += 15 * 60_000;
  for (let i = 0; i < 3; i++, now += 60_000) {
    expect((await client.post("/auth/otp/request", { email })).statusCode).toBe(202);
  }
  expect((await client.post("/auth/otp/request", { email })).statusCode).toBe(429);
});

it("revokes the whole refresh family after reuse", async () => {
  const client = await browser();
  const original = tokenCookies(await login(client, "rotation@example.test"));
  expect((await client.get(original)).statusCode).toBe(200);
  const refreshed = await client.post("/auth/refresh", undefined, original);
  expect(refreshed.statusCode).toBe(200);
  const current = tokenCookies(refreshed);
  expect(current.refresh_token).not.toBe(original.refresh_token);
  // A second tab refreshing with the same old token right away fails but keeps the family alive.
  now += 5_000;
  expect((await client.post("/auth/refresh", undefined, original)).statusCode).toBe(401);
  expect((await client.get(current)).statusCode).toBe(200);
  // Reuse after the grace window is treated as theft.
  now += 6_000;
  expect((await client.post("/auth/refresh", undefined, original)).statusCode).toBe(401);
  expect((await client.get(current)).statusCode).toBe(401);
  expect((await client.post("/auth/refresh", undefined, current)).statusCode).toBe(401);
});

it("logout-all invalidates both cookies from other devices", async () => {
  const client = await browser();
  const email = "logout@example.test";
  const first = tokenCookies(await login(client, email));
  now += 60_000;
  const second = tokenCookies(await login(client, email));
  expect((await client.post("/auth/logout-all", undefined, first)).statusCode).toBe(204);
  expect((await client.get(second)).statusCode).toBe(401);
  expect((await client.post("/auth/refresh", undefined, second)).statusCode).toBe(401);
});

it("logs out with only the refresh cookie after the access token expires", async () => {
  const client = await browser();
  const cookies = tokenCookies(await login(client, "expired-logout@example.test"));
  now += 16 * 60_000;
  expect((await client.get(cookies)).statusCode).toBe(401);
  const refreshOnly = { refresh_token: cookies.refresh_token };
  expect((await client.post("/auth/logout", undefined, refreshOnly)).statusCode).toBe(204);
  expect((await client.post("/auth/refresh", undefined, refreshOnly)).statusCode).toBe(401);
  expect((await client.post("/auth/logout", undefined, refreshOnly)).statusCode).toBe(401);
});

it("rejects access and refresh after the account session version changes", async () => {
  const client = await browser();
  const result = await login(client, "version@example.test");
  const cookies = tokenCookies(result);
  await fixture.db.user.update({ where: { id: result.json().user.id }, data: { sessionVersion: { increment: 1 } } });
  expect((await client.get(cookies)).statusCode).toBe(401);
  expect((await client.post("/auth/refresh", undefined, cookies)).statusCode).toBe(401);
});

it("enrolls TOTP once, rejects replay and records changes without storing the plaintext", async () => {
  const client = await browser();
  const user = await login(client, "staff@example.test");
  const userId = user.json().user.id;
  await fixture.db.roleAssignment.create({ data: { userId, role: "platform_admin", scopeType: "platform" } });
  const cookies = tokenCookies(user);
  expect((await client.get(cookies)).json()).toMatchObject({ mfaRequired: true, mfaVerified: false });
  const abandoned = await client.post("/auth/mfa/totp/setup", undefined, cookies);
  expect(abandoned.statusCode).toBe(200);
  // Enrollment that was never activated can restart; the old secret stops working.
  const setup = await client.post("/auth/mfa/totp/setup", undefined, cookies);
  expect(setup.statusCode).toBe(200);
  const stale = URI.parse(abandoned.json().otpauthUri);
  const authenticator = URI.parse(setup.json().otpauthUri);
  expect(authenticator.secret.base32).not.toBe(stale.secret.base32);
  const account = await fixture.db.user.findUniqueOrThrow({ where: { id: userId } });
  expect(account.totpSecretCiphertext).not.toEqual(new Uint8Array(authenticator.secret.buffer));
  expect((await client.post("/auth/mfa/totp/activate", { code: stale.generate({ timestamp: now }) }, cookies)).json().code)
    .toBe("OTP_INVALID");
  const code = authenticator.generate({ timestamp: now });
  expect((await client.post("/auth/mfa/totp/activate", { code }, cookies)).statusCode).toBe(204);
  expect((await client.post("/auth/mfa/totp/setup", undefined, cookies)).statusCode).toBe(409);
  expect((await client.post("/auth/mfa/totp/verify", { code }, cookies)).json().code).toBe("OTP_INVALID");
  now += 60_000;
  const verified = await client.post("/auth/mfa/totp/verify", {
    code: authenticator.generate({ timestamp: now }),
  }, cookies);
  expect(verified.json()).toMatchObject({ mfaRequired: true, mfaVerified: true });
  const audit = await fixture.db.auditLog.findMany({ where: { actorId: userId }, orderBy: { action: "asc" } });
  expect(audit.map(({ action }) => action)).toEqual(["totp.activate", "totp.setup", "totp.setup"]);
  expect(JSON.stringify(audit)).not.toContain(authenticator.secret.base32);
  now += 12 * 3_600_000;
  expect((await client.post("/auth/refresh", undefined, cookies)).statusCode).toBe(401);
});

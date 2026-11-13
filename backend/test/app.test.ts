import { Writable } from "node:stream";
import { afterEach, expect, it } from "vitest";
import { buildApp } from "../src/index.js";
import { maskPii } from "../src/lib/mask-pii.js";

let app: ReturnType<typeof buildApp>;
afterEach(async () => app.close());

it("exposes liveness and hides unknown routes", async () => {
  app = buildApp(false);
  const health = await app.inject("/health");
  expect(health.statusCode).toBe(200);
  expect(health.json()).toEqual({ status: "ok" });
  expect(health.headers["x-content-type-options"]).toBe("nosniff");
  const missing = await app.inject("/missing");
  expect(missing.statusCode).toBe(404);
  expect(missing.json()).toMatchObject({ code: "NOT_FOUND" });
});

it("denies routes without explicit access and does not call their handler", async () => {
  app = buildApp(false);
  app.get("/private", () => {
    throw new Error("Handler should not run");
  });
  const result = await app.inject("/private");
  expect(result.statusCode).toBe(401);
  expect(result.json()).toMatchObject({ code: "AUTH_REQUIRED", action: "login" });
});

it("omits raw URLs, headers, bodies and exception details from logs", async () => {
  let output = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += String(chunk);
      callback();
    },
  });
  app = buildApp({ stream });
  app.post("/failure/:id", { config: { public: true } }, () => {
    throw new Error("exception-secret");
  });
  const result = await app.inject({
    method: "POST",
    url: "/failure/path-secret?token=query-secret",
    headers: { authorization: "header-secret", "request-id": "request-secret" },
    payload: { secret: "body-secret" },
  });
  expect(result.statusCode).toBe(500);
  expect(result.json()).toMatchObject({ code: "INTERNAL_ERROR", correlationId: result.headers["x-request-id"] });
  expect(result.body).not.toContain("exception-secret");
  expect(output).toContain("/failure/:id");
  expect(output).toContain('"errorCode":"UNCLASSIFIED"');
  expect(output).toContain(String(result.headers["x-request-id"]));
  expect(output).not.toContain("-secret");
});

it("preserves 413 and 415 from the HTTP parser", async () => {
  app = buildApp(false);
  app.post("/input", { config: { public: true }, bodyLimit: 16 }, () => ({ ok: true }));
  for (const [contentType, payload, status] of [
    ["application/json", JSON.stringify("a".repeat(30)), 413],
    ["application/octet-stream", "data", 415],
  ] as const) {
    const response = await app.inject({
      method: "POST", url: "/input", headers: { "content-type": contentType }, payload,
    });
    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
  }
});

it("masks display values and redacts unknown or invalid values", () => {
  expect(maskPii("demo@example.test", "email")).toBe("d***@example.test");
  expect(maskPii("0900000123", "phone")).toBe("09****123");
  expect(maskPii("not an email", "email")).toBe("[REDACTED]");
  expect(maskPii("demo-token")).toBe("[REDACTED]");
});

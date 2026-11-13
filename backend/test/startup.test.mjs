import { beforeEach, expect, it, vi } from "vitest";
import { startBackend } from "../src/startup.js";

const { connect, disconnect, listen } = vi.hoisted(() => ({
  connect: vi.fn(), disconnect: vi.fn(), listen: vi.fn(),
}));
vi.mock("@prisma/client", () => ({
  Prisma: { PrismaClientInitializationError: Error },
  PrismaClient: class {
    $connect = connect;
    $disconnect = disconnect;
  },
}));
vi.mock("../src/index.js", () => ({
  buildApp: () => {
    let onClose;
    return {
      addHook: (_name, hook) => { onClose = hook; },
      listen,
      close: async () => onClose?.(),
    };
  },
}));
vi.mock("../src/modules/events/public-events.js", () => ({ registerPublicEventRoutes: vi.fn() }));

const validDatabaseUrl = "postgresql://test@127.0.0.1/db";
beforeEach(() => vi.clearAllMocks());

it.each([
  ["DATABASE_URL_MISSING", {}],
  ["DATABASE_URL_INVALID", { DATABASE_URL: "https://localhost/db" }],
  ["TRUSTED_PROXY_CIDRS_INVALID", { DATABASE_URL: validDatabaseUrl, TRUSTED_PROXY_CIDRS: "true" }],
  ["TRUSTED_PROXY_CIDRS_INVALID", { DATABASE_URL: validDatabaseUrl, TRUSTED_PROXY_CIDRS: "0.0.0.0/0" }],
])("rejects invalid config before connecting or listening (%s)", async (stage, env) => {
  expect(await startBackend(env)).toMatchObject({ failure: { stage } });
  expect(connect).not.toHaveBeenCalled();
  expect(listen).not.toHaveBeenCalled();
});

it("closes the DB and returns only the safe error code when connection fails", async () => {
  connect.mockRejectedValueOnce(Object.assign(new Error("fixture-secret"), { errorCode: "P1001" }));
  const result = await startBackend({ DATABASE_URL: validDatabaseUrl });
  expect(result).toEqual({ failure: { stage: "DATABASE_CONNECT", errorCode: "P1001" } });
  expect(disconnect).toHaveBeenCalledOnce();
  expect(listen).not.toHaveBeenCalled();
});

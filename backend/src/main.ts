import { Prisma, PrismaClient } from "@prisma/client";
import { buildApp } from "./index.js";
import { registerPublicEventRoutes } from "./modules/events/public-events.js";

const app = buildApp();
const rawPort = process.env.PORT ?? "4000";
const port = Number(rawPort);
let stage = "PORT_INVALID";

try {
  if (!/^\d{1,5}$/.test(rawPort) || port < 1 || port > 65535) {
    throw new Error("Invalid PORT");
  }
  stage = "DATABASE_URL_MISSING";
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error(stage);
  stage = "DATABASE_URL_INVALID";
  const url = new URL(databaseUrl);
  if (!["postgresql:", "postgres:"].includes(url.protocol) || !url.hostname) throw new Error(stage);
  stage = "DATABASE_CONNECT";
  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  app.addHook("onClose", async () => db.$disconnect());
  await db.$connect();
  registerPublicEventRoutes(app, db);
  stage = "HTTP_LISTEN";
  await app.listen({ port, host: process.env.HOST ?? "127.0.0.1" });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void app.close().catch(() => {
        app.log.error("Backend shutdown failed");
        process.exitCode = 1;
      });
    });
  }
} catch (error) {
  const rawCode = error instanceof Prisma.PrismaClientInitializationError ? error.errorCode : undefined;
  const errorCode = rawCode && /^P\d{4}$/.test(rawCode) ? rawCode : undefined;
  app.log.error({ stage, errorCode }, "Backend startup failed");
  process.exitCode = 1;
  await app.close().catch(() => app.log.error("Backend shutdown failed"));
}

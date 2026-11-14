import { isIP } from "node:net";
import { Prisma, PrismaClient } from "@prisma/client";
import { buildApp } from "./index.js";
import { registerPublicEventRoutes } from "./modules/events/public-events.js";
import { authConfig } from "./modules/auth/config.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerEventManagement } from "./modules/events/manage.js";

export async function startBackend(env: NodeJS.ProcessEnv) {
  let stage = "PORT_INVALID";
  let app: ReturnType<typeof buildApp> | undefined;
  try {
    const rawPort = env.PORT ?? "4000";
    const port = Number(rawPort);
    if (!/^\d{1,5}$/.test(rawPort) || port < 1 || port > 65535) throw new Error(stage);

    stage = "DATABASE_URL_MISSING";
    const databaseUrl = env.DATABASE_URL;
    if (!databaseUrl) throw new Error(stage);
    stage = "DATABASE_URL_INVALID";
    const url = new URL(databaseUrl);
    if (!["postgresql:", "postgres:"].includes(url.protocol) || !url.hostname) throw new Error(stage);

    stage = "TRUSTED_PROXY_CIDRS_INVALID";
    const trustedProxies = env.TRUSTED_PROXY_CIDRS?.trim().split(",").map((value) => value.trim()) ?? [];
    if (trustedProxies.length === 1 && trustedProxies[0] === "") trustedProxies.pop();
    for (const value of trustedProxies) {
      const [address = "", prefix, extra] = value.split("/");
      const family = isIP(address);
      if (!family || extra !== undefined || (prefix !== undefined
        && (!/^[1-9]\d{0,2}$/.test(prefix) || Number(prefix) > (family === 4 ? 32 : 128)))) {
        throw new Error(stage);
      }
    }
    stage = "AUTH_CONFIG_INVALID";
    const auth = authConfig(env);
    app = buildApp(true, trustedProxies);

    stage = "DATABASE_CONNECT";
    const db = new PrismaClient({ datasourceUrl: databaseUrl });
    app.addHook("onClose", async () => db.$disconnect());
    await db.$connect();
    registerAuthRoutes(app, db, auth, (scope, access) => {
      registerPublicEventRoutes(scope, db, access);
      registerEventManagement(scope, db, access);
    });
    stage = "HTTP_LISTEN";
    await app.listen({ port, host: env.HOST ?? "127.0.0.1" });
    return { app } as const;
  } catch (error) {
    const rawCode = error instanceof Prisma.PrismaClientInitializationError ? error.errorCode : undefined;
    const errorCode = rawCode && /^P\d{4}$/.test(rawCode) ? rawCode : undefined;
    await app?.close().catch(() => app?.log.error("Backend shutdown failed"));
    return { failure: { stage, errorCode } } as const;
  }
}

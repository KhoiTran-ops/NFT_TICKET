import { buildApp } from "./index.js";

const app = buildApp();
const rawPort = process.env.PORT ?? "4000";
const port = Number(rawPort);

try {
  if (!/^\d{1,5}$/.test(rawPort) || port < 1 || port > 65535) {
    throw new Error("Invalid PORT");
  }
  await app.listen({ port, host: process.env.HOST ?? "127.0.0.1" });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void app.close().catch(() => {
        app.log.error("Backend shutdown failed");
        process.exitCode = 1;
      });
    });
  }
} catch {
  app.log.error("Backend startup failed");
  process.exitCode = 1;
  await app.close();
}

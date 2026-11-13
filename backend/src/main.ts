import { startBackend } from "./startup.js";

const result = await startBackend(process.env);
if (result.app) {
  const { app } = result;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void app.close().catch(() => {
        app.log.error("Backend shutdown failed");
        process.exitCode = 1;
      });
    });
  }
} else {
  process.stderr.write(JSON.stringify({ level: 50, ...result.failure, msg: "Backend startup failed" }) + "\n");
  process.exitCode = 1;
}

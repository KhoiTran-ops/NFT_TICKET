import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it.each([
  ["DATABASE_URL_MISSING", undefined],
  ["DATABASE_URL_INVALID", "https://db-user:fixture-secret@localhost/db"],
  ["DATABASE_CONNECT", "postgresql://db-user:fixture-secret@127.0.0.1:1/db?connect_timeout=1"],
])("exits before listening on startup error %s", (stage, databaseUrl) => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  if (databaseUrl) env.DATABASE_URL = databaseUrl;
  const result = spawnSync(process.execPath, ["dist/main.js"], {
    env, encoding: "utf8", timeout: 5_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout).toContain(stage);
  expect(result.stdout + result.stderr).not.toMatch(/fixture-secret|Server listening/);
});

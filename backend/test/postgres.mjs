import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

export function postgresFixture() {
  const source = process.env.TEST_DATABASE_URL;
  if (!source) throw new Error("Set TEST_DATABASE_URL before running test:db");
  const url = new URL(source);
  if (!["postgresql:", "postgres:"].includes(url.protocol)
    || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("test:db requires a local PostgreSQL instance");
  }
  const schema = `tic_test_${randomUUID().replaceAll("-", "")}`;
  url.searchParams.set("schema", schema);
  const db = new PrismaClient({ datasourceUrl: url.href });
  return {
    db,
    run(...args) {
      execFileSync(process.execPath, args, {
        env: { ...process.env, DATABASE_URL: url.href, ALLOW_DEMO_SEED: "true", NODE_ENV: "test" },
        timeout: 30_000,
        stdio: "inherit",
      });
    },
    async close() {
      try {
        // The schema identifier is generated locally from a UUID.
        await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await db.$disconnect();
      }
    },
  };
}

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { serverEnv } from "@/env-server";
import * as schema from "@/server/db/schema";

const globalForDb = globalThis as typeof globalThis & {
  dbPool?: Pool;
};

const pool =
  globalForDb.dbPool ??
  new Pool({
    connectionString: serverEnv.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 20_000
  });

if (serverEnv.NODE_ENV !== "production") {
  globalForDb.dbPool = pool;
}

export const db = drizzle(pool, {
  schema,
  casing: "snake_case"
});

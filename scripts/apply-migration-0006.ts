import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = resolve(__dirname, "../drizzle/0006_wise_dragon_man.sql");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  const statements = readFileSync(sqlPath, "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  const pool = new Pool({ connectionString: url, max: 1 });

  try {
    const existing = await pool.query("SELECT to_regclass('public.card_item') AS table_name");
    if (existing.rows[0]?.table_name) {
      console.log("card_item already exists. Nothing to do.");
      return;
    }

    await pool.query("BEGIN");
    for (const statement of statements) {
      console.log("Running:", statement.split("\n")[0]);
      await pool.query(statement);
    }
    await pool.query("COMMIT");
    console.log("Migration 0006 applied successfully.");
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

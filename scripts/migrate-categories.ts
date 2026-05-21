import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "user_category" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "user"("id") ON DELETE cascade,
        "label" varchar(120) NOT NULL,
        "slug" varchar(120) NOT NULL,
        "color" varchar(32) DEFAULT 'slate' NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    console.log("✓ Created user_category table");

    await client.query(`
      CREATE INDEX IF NOT EXISTS "user_category_user_id_idx"
        ON "user_category" USING btree ("user_id")
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_category_slug_user_idx"
        ON "user_category" USING btree ("user_id", "slug")
    `);
    console.log("✓ Created indexes");

    await client.query(`ALTER TABLE "place" ALTER COLUMN "category" DROP DEFAULT`);
    await client.query(`
      ALTER TABLE "place"
        ALTER COLUMN "category" SET DATA TYPE varchar(120) USING category::text
    `);
    await client.query(`ALTER TABLE "place" ALTER COLUMN "category" SET DEFAULT 'primary_school'`);
    console.log("✓ Altered place.category to varchar");

    await client.query(`DROP TYPE IF EXISTS "public"."place_category"`);
    console.log("✓ Dropped place_category enum type");

    await client.query("COMMIT");
    console.log("\nMigration complete!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

void run();

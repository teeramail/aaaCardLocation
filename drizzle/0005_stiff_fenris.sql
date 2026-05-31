CREATE TABLE "card_location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card" DROP CONSTRAINT "card_place_id_place_id_fk";
--> statement-breakpoint
DROP INDEX "card_place_id_idx";--> statement-breakpoint
DROP INDEX "card_place_id_unique_idx";--> statement-breakpoint
ALTER TABLE "card_location" ADD CONSTRAINT "card_location_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_location" ADD CONSTRAINT "card_location_place_id_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."place"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_location_card_id_idx" ON "card_location" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "card_location_place_id_idx" ON "card_location" USING btree ("place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "card_location_card_place_idx" ON "card_location" USING btree ("card_id","place_id");--> statement-breakpoint
INSERT INTO "card_location" ("card_id", "place_id", "is_primary", "sort_order")
SELECT "id", "place_id", true, 0 FROM "card" WHERE "place_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "card" DROP COLUMN "place_id";
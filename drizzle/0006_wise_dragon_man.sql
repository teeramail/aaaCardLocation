CREATE TABLE "card_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"name_title" text NOT NULL,
	"description" text,
	"link_url" text,
	"value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"item_date" timestamp with time zone,
	"media" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_item" ADD CONSTRAINT "card_item_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_item_card_id_idx" ON "card_item" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "card_item_date_idx" ON "card_item" USING btree ("item_date");--> statement-breakpoint
CREATE INDEX "card_item_created_at_idx" ON "card_item" USING btree ("created_at");
CREATE TABLE "card" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"place_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"notes" text,
	"link_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_place_id_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."place"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_user_id_idx" ON "card" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "card_place_id_idx" ON "card" USING btree ("place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "card_place_id_unique_idx" ON "card" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "card_created_at_idx" ON "card" USING btree ("created_at");
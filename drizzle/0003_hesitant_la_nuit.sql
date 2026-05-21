CREATE TABLE "user_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" varchar(120) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"color" varchar(32) DEFAULT 'slate' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "place" ALTER COLUMN "category" SET DATA TYPE varchar(120) USING category::text;--> statement-breakpoint
ALTER TABLE "user_category" ADD CONSTRAINT "user_category_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_category_user_id_idx" ON "user_category" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_category_slug_user_idx" ON "user_category" USING btree ("user_id","slug");--> statement-breakpoint
DROP TYPE "public"."place_category";
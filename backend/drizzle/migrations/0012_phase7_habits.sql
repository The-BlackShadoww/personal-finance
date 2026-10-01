CREATE TYPE "public"."wishlist_decision" AS ENUM('pending', 'bought', 'skipped');--> statement-breakpoint
CREATE TABLE "monthly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"wins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"leaks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"worth_it" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action" text,
	"action_done" boolean,
	"health_score" integer,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"amount_cents" bigint NOT NULL,
	"url" text,
	"category_id" uuid,
	"cool_until" timestamp with time zone NOT NULL,
	"decision" "wishlist_decision" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_items_amount_check" CHECK ("wishlist_items"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "cooling_off_threshold_cents" bigint;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "cooling_off_hours" integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE "monthly_reviews" ADD CONSTRAINT "monthly_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_reviews_user_period_idx" ON "monthly_reviews" USING btree ("user_id","year","month");--> statement-breakpoint
CREATE INDEX "wishlist_items_user_idx" ON "wishlist_items" USING btree ("user_id","decision");
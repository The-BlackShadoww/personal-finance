CREATE TYPE "public"."budget_method" AS ENUM('zero_based', 'fifty_thirty_twenty', 'seventy_twenty_ten', 'category_caps');--> statement-breakpoint
CREATE TABLE "monthly_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"expected_income_cents" bigint,
	"method" "budget_method" DEFAULT 'fifty_thirty_twenty' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "rollover" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_plans_user_period_idx" ON "monthly_plans" USING btree ("user_id","year","month");
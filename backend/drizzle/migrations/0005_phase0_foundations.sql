CREATE TYPE "public"."category_tag" AS ENUM('housing', 'debt_interest', 'insurance', 'education', 'health');--> statement-breakpoint
CREATE TYPE "public"."income_kind" AS ENUM('active', 'passive', 'portfolio');--> statement-breakpoint
CREATE TYPE "public"."income_stability" AS ENUM('stable', 'variable');--> statement-breakpoint
CREATE TABLE "financial_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"income_stability" "income_stability",
	"dependents" integer,
	"has_health_insurance" boolean,
	"has_life_insurance" boolean,
	"employer_match_percent" integer,
	"retirement_age_target" integer,
	"safe_withdrawal_bps" integer DEFAULT 400 NOT NULL,
	"expected_real_return_bps" integer DEFAULT 500 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_config" ALTER COLUMN "initial_balance_cents" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "account_config" ALTER COLUMN "low_balance_threshold_cents" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "account_config" ALTER COLUMN "low_balance_threshold_cents" SET DEFAULT 500000;--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "amount_cents" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "savings_sectors" ALTER COLUMN "target_amount_cents" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "amount_cents" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "essential" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "fixed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "tag" "category_tag";--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "income_kind" "income_kind";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "currency" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale" varchar(35) DEFAULT 'en-US' NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD CONSTRAINT "financial_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Backfill for existing users; mirrors src/modules/categories/default-categories.ts.
-- "Investment" meant returns; moving money into investments becomes a transfer.
UPDATE "categories" c SET "name" = 'Investment returns', "updated_at" = now()
WHERE c."is_default" AND c."type" = 'income' AND c."name" = 'Investment'
  AND NOT EXISTS (
    SELECT 1 FROM "categories" o
    WHERE o."user_id" = c."user_id" AND o."type" = 'income' AND o."name" = 'Investment returns'
  );--> statement-breakpoint
UPDATE "categories" SET "income_kind" = 'active' WHERE "is_default" AND "type" = 'income' AND "name" IN ('Salary', 'Freelance');--> statement-breakpoint
UPDATE "categories" SET "income_kind" = 'portfolio' WHERE "is_default" AND "type" = 'income' AND "name" = 'Investment returns';--> statement-breakpoint
UPDATE "categories" SET "essential" = true WHERE "is_default" AND "type" = 'expense' AND "name" IN ('Groceries', 'Utilities', 'Transport');--> statement-breakpoint
UPDATE "categories" SET "essential" = true, "fixed" = true, "tag" = 'housing' WHERE "is_default" AND "type" = 'expense' AND "name" = 'Rent';--> statement-breakpoint
UPDATE "categories" SET "essential" = true, "tag" = 'health' WHERE "is_default" AND "type" = 'expense' AND "name" = 'Health';--> statement-breakpoint
-- Categories new users now get. Existing users receive them as ordinary
-- (deletable) categories so nothing they cannot remove appears unasked.
INSERT INTO "categories" ("user_id", "name", "type", "color", "icon", "essential", "fixed", "tag", "is_default", "sort_order")
SELECT u."id", d."name", 'expense', d."color", d."icon", d."essential", d."fixed", d."tag"::"category_tag", false,
       COALESCE((SELECT MAX(c."sort_order") FROM "categories" c WHERE c."user_id" = u."id" AND c."type" = 'expense'), -1) + d."offset"
FROM "users" u
CROSS JOIN (VALUES
  ('Insurance', '#0f766e', 'shield', true, true, 'insurance', 1),
  ('Debt interest & fees', '#b91c1c', 'credit-card', true, false, 'debt_interest', 2),
  ('Education', '#4f46e5', 'graduation-cap', true, false, 'education', 3),
  ('Dining out', '#c2410c', 'utensils', false, false, NULL, 4),
  ('Subscriptions', '#9333ea', 'tv', false, true, NULL, 5)
) AS d("name", "color", "icon", "essential", "fixed", "tag", "offset")
WHERE u."deleted_at" IS NULL
ON CONFLICT ("user_id", "name", "type") DO NOTHING;

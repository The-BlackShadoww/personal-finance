CREATE TYPE "public"."account_kind" AS ENUM('cash', 'bank', 'mobile_wallet', 'savings', 'investment', 'retirement', 'property', 'credit_card', 'loan', 'other');--> statement-breakpoint
CREATE TYPE "public"."account_nature" AS ENUM('asset', 'liability');--> statement-breakpoint
CREATE TYPE "public"."asset_class" AS ENUM('equity', 'bond', 'cash', 'real_estate', 'gold', 'mixed', 'other');--> statement-breakpoint
ALTER TYPE "public"."transaction_type" ADD VALUE 'transfer';--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"kind" "account_kind" NOT NULL,
	"nature" "account_nature" NOT NULL,
	"is_liquid" boolean NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"opening_balance_cents" bigint DEFAULT 0 NOT NULL,
	"interest_rate_bps" integer,
	"minimum_payment_cents" bigint,
	"credit_limit_cents" bigint,
	"asset_class" "asset_class",
	"expense_ratio_bps" integer,
	"color" varchar(7) DEFAULT '#6b7280' NOT NULL,
	"icon" varchar(50) DEFAULT 'wallet' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "category_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "counter_account_id" uuid;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_user_name_idx" ON "accounts" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_user_default_idx" ON "accounts" USING btree ("user_id") WHERE "accounts"."is_default";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_counter_account_id_accounts_id_fk" FOREIGN KEY ("counter_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Every user gets a default "Main account" holding their old single balance.
INSERT INTO "accounts" ("user_id", "name", "kind", "nature", "is_liquid", "is_default", "opening_balance_cents", "color", "icon")
SELECT u."id", 'Main account', 'bank', 'asset', true, true,
       COALESCE((SELECT c."initial_balance_cents" FROM "account_config" c WHERE c."user_id" = u."id"), 0),
       '#2563eb', 'landmark'
FROM "users" u;--> statement-breakpoint
UPDATE "transactions" t SET "account_id" = a."id"
FROM "accounts" a
WHERE a."user_id" = t."user_id" AND a."is_default";--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "transactions_user_account_date_idx" ON "transactions" USING btree ("user_id","account_id","date");--> statement-breakpoint
CREATE INDEX "transactions_counter_account_idx" ON "transactions" USING btree ("counter_account_id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_shape_check" CHECK (CASE WHEN "transactions"."type"::text = 'transfer'
        THEN "transactions"."counter_account_id" IS NOT NULL AND "transactions"."category_id" IS NULL
        ELSE "transactions"."counter_account_id" IS NULL AND "transactions"."category_id" IS NOT NULL END);--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_distinct_accounts_check" CHECK ("transactions"."counter_account_id" IS DISTINCT FROM "transactions"."account_id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_positive_check" CHECK ("transactions"."amount_cents" > 0);
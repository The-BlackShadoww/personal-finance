CREATE TYPE "public"."recurring_frequency" AS ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TABLE "recurring_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"account_id" uuid NOT NULL,
	"counter_account_id" uuid,
	"category_id" uuid,
	"note" text,
	"frequency" "recurring_frequency" NOT NULL,
	"anchor_date" date NOT NULL,
	"end_date" date,
	"next_due_date" date,
	"period_offset_months" integer DEFAULT 0 NOT NULL,
	"auto_post" boolean DEFAULT false NOT NULL,
	"is_subscription" boolean DEFAULT false NOT NULL,
	"paused_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_rules_transfer_shape_check" CHECK (CASE WHEN "recurring_rules"."type"::text = 'transfer'
        THEN "recurring_rules"."counter_account_id" IS NOT NULL AND "recurring_rules"."category_id" IS NULL
        ELSE "recurring_rules"."counter_account_id" IS NULL AND "recurring_rules"."category_id" IS NOT NULL END),
	CONSTRAINT "recurring_rules_amount_positive_check" CHECK ("recurring_rules"."amount_cents" > 0),
	CONSTRAINT "recurring_rules_period_offset_check" CHECK ("recurring_rules"."period_offset_months" BETWEEN -1 AND 1)
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "recurring_rule_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "occurrence_date" date;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_counter_account_id_accounts_id_fk" FOREIGN KEY ("counter_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_rules_user_due_idx" ON "recurring_rules" USING btree ("user_id","next_due_date");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_rule_id_recurring_rules_id_fk" FOREIGN KEY ("recurring_rule_id") REFERENCES "public"."recurring_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_recurring_occurrence_idx" ON "transactions" USING btree ("recurring_rule_id","occurrence_date") WHERE "transactions"."recurring_rule_id" IS NOT NULL;
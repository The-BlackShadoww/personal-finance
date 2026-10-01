CREATE TYPE "public"."goal_contribution_kind" AS ENUM('contribution', 'withdrawal', 'auto', 'opening');--> statement-breakpoint
CREATE TYPE "public"."goal_funding_rule" AS ENUM('percent_of_income', 'fixed_monthly', 'manual');--> statement-breakpoint
CREATE TYPE "public"."goal_kind" AS ENUM('emergency', 'sinking', 'long_term', 'custom');--> statement-breakpoint
CREATE TYPE "public"."goal_withdrawal_reason" AS ENUM('emergency', 'planned_purchase', 'rebalancing', 'other');--> statement-breakpoint
CREATE TABLE "goal_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"kind" "goal_contribution_kind" NOT NULL,
	"source_transaction_id" uuid,
	"transfer_transaction_id" uuid,
	"reason" "goal_withdrawal_reason",
	"note" varchar(200),
	"date" date NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_contributions_sign_check" CHECK (CASE WHEN "goal_contributions"."kind"::text = 'withdrawal'
        THEN "goal_contributions"."amount_cents" < 0 AND "goal_contributions"."reason" IS NOT NULL
        ELSE "goal_contributions"."amount_cents" > 0 END)
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"kind" "goal_kind" NOT NULL,
	"account_id" uuid NOT NULL,
	"target_amount_cents" bigint,
	"target_date" date,
	"target_months" integer,
	"repeats_yearly" boolean DEFAULT false NOT NULL,
	"category_id" uuid,
	"priority" integer DEFAULT 0 NOT NULL,
	"funding_rule" "goal_funding_rule" DEFAULT 'manual' NOT NULL,
	"funding_percent_bps" integer,
	"funding_amount_cents" bigint,
	"color" varchar(7) DEFAULT '#16a34a' NOT NULL,
	"icon" varchar(50) DEFAULT 'piggy-bank' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_funding_shape_check" CHECK (CASE "goals"."funding_rule"
        WHEN 'percent_of_income' THEN "goals"."funding_percent_bps" BETWEEN 1 AND 10000
        WHEN 'fixed_monthly' THEN "goals"."funding_amount_cents" > 0
        ELSE true END)
);
--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_source_transaction_id_transactions_id_fk" FOREIGN KEY ("source_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_transfer_transaction_id_transactions_id_fk" FOREIGN KEY ("transfer_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goal_contributions_goal_id_idx" ON "goal_contributions" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "goal_contributions_user_id_idx" ON "goal_contributions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "goal_contributions_source_idx" ON "goal_contributions" USING btree ("source_transaction_id");--> statement-breakpoint
CREATE INDEX "goals_user_id_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_user_name_idx" ON "goals" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_user_emergency_idx" ON "goals" USING btree ("user_id") WHERE "goals"."kind" = 'emergency';--> statement-breakpoint
-- Savings sectors become goals held in the default account. Each starts with an
-- opening contribution equal to what the sector showed (its percentage of the
-- liquid balance), so no number jumps. The first sector named like
-- "Emergency" becomes the emergency fund; the service creates one for
-- everyone else. Sectors stay in place for one release.
WITH legs AS (
  SELECT user_id, account_id, CASE WHEN type = 'income' THEN amount_cents ELSE -amount_cents END AS flow
  FROM transactions WHERE deleted_at IS NULL
  UNION ALL
  SELECT user_id, counter_account_id, amount_cents
  FROM transactions WHERE deleted_at IS NULL AND type = 'transfer'
),
liquid AS (
  SELECT a.user_id, SUM(a.opening_balance_cents + COALESCE(f.flow, 0)) AS balance
  FROM accounts a
  LEFT JOIN (SELECT account_id, SUM(flow) AS flow FROM legs GROUP BY account_id) f ON f.account_id = a.id
  WHERE a.is_liquid AND a.nature = 'asset'
  GROUP BY a.user_id
),
ranked AS (
  SELECT s.*,
         ROW_NUMBER() OVER (
           PARTITION BY s.user_id, (lower(s.name) LIKE 'emergency%')
           ORDER BY s.sort_order, s.created_at
         ) AS emergency_rank
  FROM savings_sectors s
),
inserted AS (
  INSERT INTO goals ("user_id", "name", "kind", "account_id", "target_amount_cents", "priority", "color", "icon")
  SELECT r.user_id, r.name,
         CASE WHEN lower(r.name) LIKE 'emergency%' AND r.emergency_rank = 1 THEN 'emergency' ELSE 'custom' END::goal_kind,
         a.id,
         CASE WHEN lower(r.name) LIKE 'emergency%' AND r.emergency_rank = 1 THEN NULL ELSE r.target_amount_cents END,
         r.sort_order, r.color, r.icon
  FROM ranked r
  JOIN accounts a ON a.user_id = r.user_id AND a.is_default
  RETURNING id, user_id, name
)
INSERT INTO goal_contributions ("goal_id", "user_id", "amount_cents", "kind", "note", "date", "period_year", "period_month")
SELECT i.id, i.user_id, ROUND(l.balance * s.percentage / 100.0)::bigint, 'opening',
       'Carried over from savings sectors', CURRENT_DATE,
       EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int
FROM inserted i
JOIN savings_sectors s ON s.user_id = i.user_id AND s.name = i.name
JOIN liquid l ON l.user_id = i.user_id
WHERE ROUND(l.balance * s.percentage / 100.0) > 0;

CREATE TABLE "account_valuations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"value_cents" bigint NOT NULL,
	"note" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_valuations_value_check" CHECK ("account_valuations"."value_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "account_valuations" ADD CONSTRAINT "account_valuations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_valuations" ADD CONSTRAINT "account_valuations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_valuations_account_date_idx" ON "account_valuations" USING btree ("account_id","date");--> statement-breakpoint
CREATE INDEX "account_valuations_user_id_idx" ON "account_valuations" USING btree ("user_id");
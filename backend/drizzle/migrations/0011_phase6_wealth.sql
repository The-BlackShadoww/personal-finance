CREATE TABLE "target_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_class" "asset_class" NOT NULL,
	"percent_bps" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "target_allocations_percent_check" CHECK ("target_allocations"."percent_bps" BETWEEN 1 AND 10000)
);
--> statement-breakpoint
ALTER TABLE "target_allocations" ADD CONSTRAINT "target_allocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "target_allocations_user_class_idx" ON "target_allocations" USING btree ("user_id","asset_class");
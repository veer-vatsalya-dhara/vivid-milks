CREATE TYPE "public"."payment_method" AS ENUM('upi', 'cash');--> statement-breakpoint
CREATE TYPE "public"."payment_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"blocks" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buildings_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"amount_paise" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"status" "payment_request_status" DEFAULT 'pending' NOT NULL,
	"decided_by" integer,
	"decided_at" timestamp with time zone,
	"wallet_txn_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ALTER COLUMN "area" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "building_id" integer;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "block" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "floor" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_wallet_txn_id_wallet_txns_id_fk" FOREIGN KEY ("wallet_txn_id") REFERENCES "public"."wallet_txns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_requests_status_index" ON "payment_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_requests_customer_id_index" ON "payment_requests" USING btree ("customer_id");--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Orders now close at 6 PM the evening before delivery.
UPDATE "settings" SET "value" = '18:00' WHERE "key" = 'orderCutoffTime';

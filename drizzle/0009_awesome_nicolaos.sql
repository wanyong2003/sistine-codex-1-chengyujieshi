CREATE TABLE IF NOT EXISTS "query_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"scope_key" text NOT NULL,
	"usage_date" varchar(10) NOT NULL,
	"successful_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "subscription_queries" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "query_usage_scope_scope_date_unique" ON "query_usage" USING btree ("scope_key","usage_date");

CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appeals" (
	"id" text PRIMARY KEY,
	"dossier_id" text NOT NULL,
	"appeal_text" text NOT NULL,
	"accepted" boolean DEFAULT false NOT NULL,
	"new_caste" text,
	"new_honorific_title" text,
	"headline" text,
	"reason" text NOT NULL,
	"scripture" text,
	"caste_before" text NOT NULL,
	"caste_after" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dossiers" (
	"id" text PRIMARY KEY,
	"created_at" text NOT NULL,
	"caste" text NOT NULL,
	"biocarbon_ratio" integer NOT NULL,
	"honorific_title" text NOT NULL,
	"headline" text NOT NULL,
	"paragraph_1" text NOT NULL,
	"paragraph_2" text NOT NULL,
	"paragraph_3" text NOT NULL,
	"room_type" text,
	"items_json" text DEFAULT '[]' NOT NULL,
	"suggestions_json" text DEFAULT '[]' NOT NULL,
	"evidence_filename" text,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "scan_api_logs" (
	"id" text PRIMARY KEY,
	"dossier_id" text NOT NULL,
	"call_type" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"candidates_tokens" integer DEFAULT 0 NOT NULL,
	"thoughts_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"error_message" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_ledger" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"ref" text,
	"balance_after" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL UNIQUE,
	"credits" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_account_user_id" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_appeals_dossier_created" ON "appeals" ("dossier_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_dossiers_created_at" ON "dossiers" ("created_at");--> statement-breakpoint
CREATE INDEX "idx_dossiers_user_id" ON "dossiers" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_scan_api_logs_dossier_id" ON "scan_api_logs" ("dossier_id");--> statement-breakpoint
CREATE INDEX "idx_scan_api_logs_created_at" ON "scan_api_logs" ("created_at");--> statement-breakpoint
CREATE INDEX "idx_session_user_id" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_verification_identifier" ON "verification" ("identifier");--> statement-breakpoint
CREATE INDEX "idx_wallet_ledger_user_created" ON "wallet_ledger" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_wallets_user_id" ON "wallets" ("user_id");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
CREATE TABLE "injunction_tasks" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"dossier_id" text,
	"action" text NOT NULL,
	"replaces" text NOT NULL,
	"why" text NOT NULL,
	"category" text NOT NULL,
	"impact" text NOT NULL,
	"effort" text NOT NULL,
	"created_at" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" text,
	"points" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "injunction_json" text;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "injunction_hash" text;--> statement-breakpoint
CREATE INDEX "idx_injunction_tasks_user_created" ON "injunction_tasks" ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "injunction_tasks" ADD CONSTRAINT "injunction_tasks_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
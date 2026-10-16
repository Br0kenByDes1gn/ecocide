ALTER TABLE "dossiers" ADD COLUMN "accepted_at" text;--> statement-breakpoint
ALTER TABLE "injunction_tasks" ALTER COLUMN "dossier_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_injunction_tasks_user_dossier_action" ON "injunction_tasks" ("user_id","dossier_id","action");--> statement-breakpoint
ALTER TABLE "injunction_tasks" ADD CONSTRAINT "injunction_tasks_dossier_id_dossiers_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE;
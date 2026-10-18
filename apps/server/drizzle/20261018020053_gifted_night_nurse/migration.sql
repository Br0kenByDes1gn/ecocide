ALTER TABLE "dossiers" ADD COLUMN "injunction_issued_at" text;--> statement-breakpoint
CREATE INDEX "idx_injunction_tasks_dossier" ON "injunction_tasks" ("dossier_id");
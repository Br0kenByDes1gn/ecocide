ALTER TABLE "dossiers" ADD COLUMN "subject_email" text;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "informant_user_id" text;--> statement-breakpoint
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_informant_user_id_user_id_fkey" FOREIGN KEY ("informant_user_id") REFERENCES "user"("id") ON DELETE SET NULL;
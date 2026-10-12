-- Baseline migration (idempotent) for the Drizzle ORM switch.
--
-- The tables/indexes below already exist in the legacy `apps/server/data`
-- database created by the old hand-rolled DDL, so every statement uses
-- `IF NOT EXISTS` (hand-edited from drizzle-kit's generated output). This makes
-- the migration a safe no-op against existing databases while still fully
-- bootstrapping fresh ones. Future schema changes will be generated and applied
-- as regular (non-idempotent) drizzle-kit migrations.
CREATE TABLE IF NOT EXISTS `appeals` (
	`id` text PRIMARY KEY,
	`dossier_id` text NOT NULL,
	`appeal_text` text NOT NULL,
	`accepted` integer DEFAULT false NOT NULL,
	`new_caste` text,
	`new_honorific_title` text,
	`headline` text,
	`reason` text NOT NULL,
	`scripture` text,
	`caste_before` text NOT NULL,
	`caste_after` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `dossiers` (
	`id` text PRIMARY KEY,
	`created_at` text NOT NULL,
	`caste` text NOT NULL,
	`biocarbon_ratio` integer NOT NULL,
	`life_stage` text NOT NULL,
	`equipped_wealth` text NOT NULL,
	`energy_level` text NOT NULL,
	`apparent_presentation` text NOT NULL,
	`honorific_title` text NOT NULL,
	`headline` text NOT NULL,
	`paragraph_1` text NOT NULL,
	`paragraph_2` text NOT NULL,
	`paragraph_3` text NOT NULL,
	`stylized_portrait` text,
	`source_snapshot` text,
	`avatar_url` text,
	`avatar_status` text DEFAULT 'pending',
	`avatar_engine` text,
	`landmarks_json` text,
	`telemetry_json` text,
	`portrait_style` text DEFAULT 'neon-hologram',
	`portrait_color` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `scan_api_logs` (
	`id` text PRIMARY KEY,
	`dossier_id` text NOT NULL,
	`call_type` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`prompt_tokens` integer DEFAULT 0 NOT NULL,
	`candidates_tokens` integer DEFAULT 0 NOT NULL,
	`thoughts_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'success' NOT NULL,
	`error_message` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_appeals_dossier_created` ON `appeals` (`dossier_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dossiers_created_at` ON `dossiers` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_scan_api_logs_dossier_id` ON `scan_api_logs` (`dossier_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_scan_api_logs_created_at` ON `scan_api_logs` (`created_at`);
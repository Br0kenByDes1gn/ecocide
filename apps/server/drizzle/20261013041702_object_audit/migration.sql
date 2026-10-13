ALTER TABLE `dossiers` ADD `room_type` text;--> statement-breakpoint
ALTER TABLE `dossiers` ADD `items_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `dossiers` ADD `suggestions_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `dossiers` ADD `evidence_filename` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_verification`(`id`, `identifier`, `value`, `expires_at`, `created_at`, `updated_at`) SELECT `id`, `identifier`, `value`, `expires_at`, `created_at`, `updated_at` FROM `verification`;--> statement-breakpoint
DROP TABLE `verification`;--> statement-breakpoint
ALTER TABLE `__new_verification` RENAME TO `verification`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_verification_identifier` ON `verification` (`identifier`);--> statement-breakpoint
ALTER TABLE `dossiers` DROP COLUMN `life_stage`;--> statement-breakpoint
ALTER TABLE `dossiers` DROP COLUMN `equipped_wealth`;--> statement-breakpoint
ALTER TABLE `dossiers` DROP COLUMN `energy_level`;--> statement-breakpoint
ALTER TABLE `dossiers` DROP COLUMN `apparent_presentation`;--> statement-breakpoint
ALTER TABLE `dossiers` DROP COLUMN `stylized_portrait`;--> statement-breakpoint
ALTER TABLE `dossiers` DROP COLUMN `source_snapshot`;--> statement-breakpoint
ALTER TABLE `dossiers` DROP COLUMN `avatar_url`;--> statement-breakpoint
ALTER TABLE `dossiers` DROP COLUMN `avatar_status`;--> statement-breakpoint
ALTER TABLE `dossiers` DROP COLUMN `avatar_engine`;--> statement-breakpoint
ALTER TABLE `dossiers` DROP COLUMN `landmarks_json`;--> statement-breakpoint
ALTER TABLE `dossiers` DROP COLUMN `telemetry_json`;--> statement-breakpoint
ALTER TABLE `dossiers` DROP COLUMN `portrait_style`;--> statement-breakpoint
ALTER TABLE `dossiers` DROP COLUMN `portrait_color`;
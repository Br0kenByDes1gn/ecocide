ALTER TABLE `injunction_tasks` ADD `completed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `injunction_tasks` ADD `completed_at` text;--> statement-breakpoint
ALTER TABLE `injunction_tasks` ADD `points` integer DEFAULT 0 NOT NULL;
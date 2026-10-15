CREATE TABLE `injunction_tasks` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`dossier_id` text,
	`action` text NOT NULL,
	`replaces` text NOT NULL,
	`why` text NOT NULL,
	`category` text NOT NULL,
	`impact` text NOT NULL,
	`effort` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_injunction_tasks_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_injunction_tasks_user_created` ON `injunction_tasks` (`user_id`,`created_at`);
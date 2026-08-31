CREATE TABLE `rfi_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`rfi_id` text NOT NULL,
	`project_id` text NOT NULL,
	`author_name` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`server_last_synced_at` integer
);
--> statement-breakpoint
CREATE INDEX `rfi_comments_rfi_idx` ON `rfi_comments` (`rfi_id`,`created_at`);
CREATE TABLE `project_update_media` (
	`id` text PRIMARY KEY NOT NULL,
	`update_id` text NOT NULL,
	`type` text NOT NULL,
	`staged_uri` text,
	`url` text,
	`file_name` text NOT NULL,
	`mime_type` text,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `project_update_media_update_idx` ON `project_update_media` (`update_id`,`position`);--> statement-breakpoint
CREATE TABLE `project_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`stage_id` text,
	`activity_id` text,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`description_html` text,
	`author_name` text,
	`author_role` text,
	`status` text,
	`created_at` text NOT NULL,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `project_updates_project_idx` ON `project_updates` (`project_id`,`created_at`);
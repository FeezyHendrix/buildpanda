CREATE TABLE `drawing_markup_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`markup_id` text NOT NULL,
	`project_id` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`media_kind` text,
	`staged_media_uri` text,
	`media_duration_seconds` integer,
	`assignee_id` text,
	`author_name` text DEFAULT '' NOT NULL,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `drawing_markup_comments_markup_idx` ON `drawing_markup_comments` (`markup_id`,`created_at`);
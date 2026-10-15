CREATE TABLE `update_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`update_id` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`body_html` text,
	`audio_file_id` text,
	`audio_duration_seconds` integer,
	`staged_audio_uri` text,
	`audio_mime_type` text,
	`created_at` text NOT NULL,
	`is_pending_sync` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `update_comments_thread_idx` ON `update_comments` (`project_id`,`update_id`,`created_at`);
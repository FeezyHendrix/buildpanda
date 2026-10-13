CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`category_label` text DEFAULT '' NOT NULL,
	`amount` real NOT NULL,
	`transacted_at` text NOT NULL,
	`vendor` text,
	`stage_id` text,
	`stage_name` text,
	`credit` integer DEFAULT false NOT NULL,
	`receipt_file_id` text,
	`receipt_staged_uri` text,
	`receipt_mime_type` text,
	`created_by_name` text,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `expenses_project_idx` ON `expenses` (`project_id`,`transacted_at`);
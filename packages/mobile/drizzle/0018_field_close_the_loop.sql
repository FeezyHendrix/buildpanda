CREATE TABLE `change_request_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`change_request_id` text NOT NULL,
	`project_id` text NOT NULL,
	`author_name` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`server_last_synced_at` integer
);
--> statement-breakpoint
CREATE INDEX `change_request_comments_cr_idx` ON `change_request_comments` (`change_request_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `daily_logs` ADD `weather_condition` text;--> statement-breakpoint
ALTER TABLE `daily_logs` ADD `temperature_c` real;--> statement-breakpoint
ALTER TABLE `daily_logs` ADD `workers_expected` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_logs` ADD `workers_present` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `category_id` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `mime_type` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `staged_uri` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `is_pending_sync` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `look_aheads` ADD `activity_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `material_approvals` ADD `document_id` text;--> statement-breakpoint
ALTER TABLE `material_approvals` ADD `document_version_id` text;--> statement-breakpoint
ALTER TABLE `material_approvals` ADD `source_markup_id` text;--> statement-breakpoint
ALTER TABLE `rfi_comments` ADD `official` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `rfis` ADD `ball_in_court_id` text;--> statement-breakpoint
ALTER TABLE `rfis` ADD `document_id` text;--> statement-breakpoint
ALTER TABLE `rfis` ADD `document_version_id` text;--> statement-breakpoint
ALTER TABLE `rfis` ADD `source_markup_id` text;
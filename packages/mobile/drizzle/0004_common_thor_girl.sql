CREATE TABLE `daily_log_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`log_date` text NOT NULL,
	`author_name` text DEFAULT '' NOT NULL,
	`body_text` text DEFAULT '' NOT NULL,
	`voided` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`is_pending_sync` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `daily_log_entries_day_idx` ON `daily_log_entries` (`project_id`,`log_date`);--> statement-breakpoint
CREATE TABLE `daily_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`log_date` text NOT NULL,
	`weather_condition` text,
	`temperature_c` integer,
	`workers_expected` integer DEFAULT 0 NOT NULL,
	`workers_present` integer DEFAULT 0 NOT NULL,
	`total_hours` integer DEFAULT 0 NOT NULL,
	`summary` text,
	`voided_at` text,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`server_last_synced_at` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `daily_logs_project_idx` ON `daily_logs` (`project_id`,`log_date`);
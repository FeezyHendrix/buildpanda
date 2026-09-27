CREATE TABLE `daily_log_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`log_date` text NOT NULL,
	`activity_id` text NOT NULL,
	`activity_name` text DEFAULT '' NOT NULL,
	`hours_logged` integer DEFAULT 0 NOT NULL,
	`delay_reason_code` text,
	`delay_note` text,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `daily_log_activities_day_idx` ON `daily_log_activities` (`project_id`,`log_date`);--> statement-breakpoint
ALTER TABLE `daily_logs` DROP COLUMN `weather_condition`;--> statement-breakpoint
ALTER TABLE `daily_logs` DROP COLUMN `temperature_c`;--> statement-breakpoint
ALTER TABLE `daily_logs` DROP COLUMN `workers_expected`;--> statement-breakpoint
ALTER TABLE `daily_logs` DROP COLUMN `workers_present`;
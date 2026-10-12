CREATE TABLE `daily_log_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`scope` text NOT NULL,
	`fields` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `daily_log_templates_project_idx` ON `daily_log_templates` (`project_id`);--> statement-breakpoint
ALTER TABLE `daily_log_entries` ADD `template_id` text;--> statement-breakpoint
ALTER TABLE `daily_log_entries` ADD `responses` text;--> statement-breakpoint
ALTER TABLE `daily_log_entries` ADD `notes_html` text;
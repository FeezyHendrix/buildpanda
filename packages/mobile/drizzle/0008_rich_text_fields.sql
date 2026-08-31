ALTER TABLE `change_requests` ADD `description_html` text;
--> statement-breakpoint
ALTER TABLE `daily_log_entries` ADD `body_html` text;
--> statement-breakpoint
ALTER TABLE `rfi_comments` ADD `content_html` text;

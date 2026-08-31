CREATE TABLE `document_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`file_count` integer DEFAULT 0 NOT NULL,
	`total_size` text DEFAULT '' NOT NULL,
	`tone` text DEFAULT 'brand' NOT NULL,
	`group` text DEFAULT 'document' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `document_categories_project_idx` ON `document_categories` (`project_id`,`group`);
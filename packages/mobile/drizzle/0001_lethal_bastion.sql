CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`file_name` text NOT NULL,
	`size` text DEFAULT '' NOT NULL,
	`category` text,
	`group` text DEFAULT 'document' NOT NULL,
	`status` text,
	`version_no` integer DEFAULT 1 NOT NULL,
	`current_version_id` text,
	`uploaded_at` text,
	`local_uri` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `documents_project_idx` ON `documents` (`project_id`,`group`);
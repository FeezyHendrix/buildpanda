CREATE TABLE `drawing_markups` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`document_id` text NOT NULL,
	`document_version_id` text NOT NULL,
	`page_no` integer DEFAULT 1 NOT NULL,
	`kind` text NOT NULL,
	`geometry` text NOT NULL,
	`color` text DEFAULT '#004DE7' NOT NULL,
	`resolved_at` text,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `drawing_markups_sheet_idx` ON `drawing_markups` (`document_version_id`,`page_no`);

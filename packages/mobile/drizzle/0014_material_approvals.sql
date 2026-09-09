CREATE TABLE `material_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`material_name` text DEFAULT '' NOT NULL,
	`specification` text,
	`quantity` real DEFAULT 0 NOT NULL,
	`unit` text DEFAULT 'item' NOT NULL,
	`supplier` text,
	`needed_by` text,
	`phase_id` text,
	`phase_name` text,
	`activity_id` text,
	`activity_name` text,
	`description` text,
	`status` text DEFAULT 'Pending' NOT NULL,
	`response` text,
	`due_date` text,
	`requested_reviewer_id` text,
	`requested_reviewer_name` text,
	`reviewed_by_name` text,
	`reviewed_at` text,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`server_last_synced_at` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `material_approvals_project_idx` ON `material_approvals` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `material_approval_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`approval_id` text NOT NULL,
	`project_id` text NOT NULL,
	`author_name` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`server_last_synced_at` integer
);
--> statement-breakpoint
CREATE INDEX `material_approval_comments_approval_idx` ON `material_approval_comments` (`approval_id`,`created_at`);

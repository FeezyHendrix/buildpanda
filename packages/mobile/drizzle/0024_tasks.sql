CREATE TABLE `task_columns` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`building_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text,
	`position` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `task_columns_board_idx` ON `task_columns` (`project_id`,`building_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`building_id` text NOT NULL,
	`column_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`due_date` text,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`assignees` text DEFAULT '[]' NOT NULL,
	`assigned_to_me` integer DEFAULT false NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`subtask_total` integer DEFAULT 0 NOT NULL,
	`subtask_done` integer DEFAULT 0 NOT NULL,
	`created_by_name` text,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_board_idx` ON `tasks` (`project_id`,`building_id`,`column_id`);
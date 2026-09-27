CREATE TABLE `feature_pull_syncs` (
	`id` text PRIMARY KEY NOT NULL,
	`feature` text NOT NULL,
	`project_id` text NOT NULL,
	`last_synced_at` integer
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`resource` text NOT NULL,
	`entity_id` text NOT NULL,
	`project_id` text NOT NULL,
	`operation` text NOT NULL,
	`base_updated_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outbox_status_idx` ON `outbox` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `rfis` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`number` integer DEFAULT 0 NOT NULL,
	`subject` text NOT NULL,
	`question` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`priority` text DEFAULT 'Normal' NOT NULL,
	`ball_in_court_name` text,
	`due_date` text,
	`official_response` text,
	`cost_impact` integer DEFAULT false NOT NULL,
	`schedule_impact` integer DEFAULT false NOT NULL,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`server_last_synced_at` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `rfis_project_idx` ON `rfis` (`project_id`,`updated_at`);
CREATE TABLE `change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`reason` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`cost_impact` integer DEFAULT 0 NOT NULL,
	`time_impact_days` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'NGN' NOT NULL,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `change_requests_project_idx` ON `change_requests` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `inspections` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT 'General Progress' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Scheduled' NOT NULL,
	`risk_level` text,
	`scheduled_at` text DEFAULT '' NOT NULL,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inspections_project_idx` ON `inspections` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `look_aheads` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`start_date` text DEFAULT '' NOT NULL,
	`end_date` text DEFAULT '' NOT NULL,
	`total_workers` integer,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `look_aheads_project_idx` ON `look_aheads` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `material_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`material_name` text DEFAULT '' NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`supplier` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `material_orders_project_idx` ON `material_orders` (`project_id`,`updated_at`);
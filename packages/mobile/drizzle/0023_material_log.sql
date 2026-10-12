CREATE TABLE `material_ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`entry_type` text NOT NULL,
	`status` text DEFAULT 'Posted' NOT NULL,
	`material_name` text NOT NULL,
	`unit` text NOT NULL,
	`quantity` real NOT NULL,
	`stage_id` text,
	`stage_name` text,
	`approval_status` text DEFAULT 'Pending' NOT NULL,
	`occurred_at` text NOT NULL,
	`negative_stock` integer DEFAULT false NOT NULL,
	`logged_by_name` text,
	`notes_html` text,
	`is_pending_sync` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `material_ledger_project_idx` ON `material_ledger_entries` (`project_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `material_stock` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`material_name` text NOT NULL,
	`unit` text NOT NULL,
	`location_key` text DEFAULT 'default' NOT NULL,
	`on_hand_qty` real DEFAULT 0 NOT NULL,
	`low_stock` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `material_stock_project_idx` ON `material_stock` (`project_id`);
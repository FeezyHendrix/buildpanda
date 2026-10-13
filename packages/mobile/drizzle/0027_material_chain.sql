ALTER TABLE `material_orders` ADD `approval_id` text;--> statement-breakpoint
ALTER TABLE `material_orders` ADD `approval_title` text;--> statement-breakpoint
ALTER TABLE `material_orders` ADD `approval_status` text;--> statement-breakpoint
ALTER TABLE `material_orders` ADD `delivered_quantity` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `material_orders` ADD `pending_delivery_qty` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `material_orders` ADD `pending_delivery_note` text;--> statement-breakpoint
ALTER TABLE `material_ledger_entries` ADD `material_order_id` text;--> statement-breakpoint
ALTER TABLE `material_ledger_entries` ADD `material_order_title` text;
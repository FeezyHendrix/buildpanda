ALTER TABLE `rfi_comments` ADD `is_proposed_response` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `rfis` ADD `visibility` text DEFAULT 'internal' NOT NULL;
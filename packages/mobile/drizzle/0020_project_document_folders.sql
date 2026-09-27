PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_document_categories` (
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`file_count` integer DEFAULT 0 NOT NULL,
	`total_size` text DEFAULT '' NOT NULL,
	`tone` text DEFAULT 'brand' NOT NULL,
	`group` text DEFAULT 'document' NOT NULL,
	PRIMARY KEY(`project_id`, `id`)
);
--> statement-breakpoint
INSERT INTO `__new_document_categories`("id", "project_id", "name", "file_count", "total_size", "tone", "group") SELECT "id", "project_id", "name", "file_count", "total_size", "tone", "group" FROM `document_categories`;--> statement-breakpoint
DROP TABLE `document_categories`;--> statement-breakpoint
ALTER TABLE `__new_document_categories` RENAME TO `document_categories`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `document_categories_project_idx` ON `document_categories` (`project_id`,`group`);
--> statement-breakpoint
-- Recover folders lost to the old category-only key, even when upgrading offline.
INSERT OR IGNORE INTO `document_categories` (`id`, `project_id`, `name`, `file_count`, `total_size`, `tone`, `group`)
SELECT `category_id`, `project_id`, COALESCE(MAX(`category`), 'Other files'), COUNT(*), '', 'brand', `group`
FROM `documents`
WHERE `category_id` IS NOT NULL
GROUP BY `project_id`, `category_id`, `group`;

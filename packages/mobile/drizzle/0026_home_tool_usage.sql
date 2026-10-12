CREATE TABLE `home_tool_usage` (
	`key` text PRIMARY KEY NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	`opens` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer DEFAULT 0 NOT NULL,
	`position` integer,
	`hidden` integer DEFAULT false NOT NULL
);

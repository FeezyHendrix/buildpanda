ALTER TABLE `daily_log_activities` ADD `building_id` text;--> statement-breakpoint
UPDATE outbox SET entity_id = (
  SELECT project_id || ':' || building_id || ':' || log_date FROM daily_logs WHERE id = outbox.entity_id
) WHERE resource = 'daily-logs' AND entity_id IN (
  SELECT id FROM daily_logs WHERE building_id IS NOT NULL AND id = project_id || ':' || log_date
);
--> statement-breakpoint
UPDATE daily_logs SET id = project_id || ':' || building_id || ':' || log_date
WHERE building_id IS NOT NULL AND id = project_id || ':' || log_date;

import type { Knex } from "knex";

// Update photos are served from /files/:id/download, which grants access via
// the file's project_id. Files uploaded through the update dialog before the
// fix were stored with project_id NULL, so every viewer except the uploader
// got 403. Link those files to the update's project so existing images render.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE uploaded_files f
    SET project_id = u.project_id
    FROM update_media m
    JOIN project_updates u ON u.id = m.update_id
    WHERE f.project_id IS NULL
      AND m.url LIKE '%/files/' || f.id || '/download'
  `);
}

export async function down(): Promise<void> {
  // Irreversible data backfill: the original NULL project links are not kept.
}

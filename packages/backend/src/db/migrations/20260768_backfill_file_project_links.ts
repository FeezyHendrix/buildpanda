import type { Knex } from "knex";

// Files served from /files/:id are authorized by uploaded_files.project_id: when
// it is NULL the download route falls back to owner-only, so project members
// viewing update photos, documents, takeoffs or ledger attachments got a 403.
// Several server-side upload paths historically inserted rows without setting
// project_id (see attachImportedDocument). Heal every orphaned file from the
// tables that reference it. update_media is handled by an earlier migration; the
// FK-referencing tables are covered here. Runs only where project_id is NULL, so
// genuinely projectless files (avatars, personal uploads) stay owner-only.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE uploaded_files f SET project_id = d.project_id
    FROM project_documents d
    WHERE f.project_id IS NULL AND d.file_id = f.id AND d.project_id IS NOT NULL
  `);

  await knex.raw(`
    UPDATE uploaded_files f SET project_id = d.project_id
    FROM document_versions v
    JOIN project_documents d ON d.id = v.document_id
    WHERE f.project_id IS NULL AND v.file_id = f.id AND d.project_id IS NOT NULL
  `);

  await knex.raw(`
    UPDATE uploaded_files f SET project_id = t.project_id
    FROM takeoff_jobs t
    WHERE f.project_id IS NULL AND t.file_id = f.id AND t.project_id IS NOT NULL
  `);

  await knex.raw(`
    UPDATE uploaded_files f SET project_id = p.project_id
    FROM proposal_plans pp
    JOIN proposals p ON p.id = pp.proposal_id
    WHERE f.project_id IS NULL AND pp.file_id = f.id AND p.project_id IS NOT NULL
  `);

  await knex.raw(`
    UPDATE uploaded_files f SET project_id = e.project_id
    FROM material_ledger_entry_files mf
    JOIN material_ledger_entries e ON e.id = mf.entry_id
    WHERE f.project_id IS NULL AND mf.file_id = f.id AND e.project_id IS NOT NULL
  `);
}

export async function down(): Promise<void> {
  // Irreversible data backfill: the original NULL project links are not kept.
}

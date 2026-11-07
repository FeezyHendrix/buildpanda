import type { Knex } from "knex";
import type { FastifyBaseLogger } from "fastify";
import { deleteStoredFile } from "../../lib/file-storage.ts";
import type { QueueManager } from "../../lib/queue/index.ts";

export const ORPHAN_FILE_QUEUE = "orphan-file-sweep";
const INTERVAL_MS = 24 * 60 * 60 * 1_000;
// A form abandoned after its upload step leaves the file behind; a week is
// long enough for any legitimate "upload now, attach later" flow to finish.
const TTL_DAYS = 7;
const BATCH = 200;

interface Reference {
  table: string;
  column: string;
  kind: "fk" | "json" | "text";
}

/**
 * Every place a file id can be written down, discovered from the schema so a
 * new table that links files is covered without anyone remembering this job:
 * foreign keys to uploaded_files, every jsonb column named `attachments`, and
 * every rich-text column (ids appear inside /files/:id/view links).
 */
export async function fileReferences(db: Knex): Promise<Reference[]> {
  const fks = await db.raw<{ rows: { table: string; column: string }[] }>(`
    SELECT tc.table_name AS "table", kcu.column_name AS "column"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND ccu.table_name = 'uploaded_files'`);
  const cols = await db.raw<{ rows: { table: string; column: string; data_type: string }[] }>(`
    SELECT table_name AS "table", column_name AS "column", data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((column_name = 'attachments' AND data_type = 'jsonb')
        OR (data_type = 'text' AND (column_name LIKE '%\\_html' OR column_name IN ('body', 'content'))))`);
  return [
    ...fks.rows.map((r): Reference => ({ ...r, kind: "fk" })),
    ...cols.rows.map((r): Reference => ({ table: r.table, column: r.column, kind: r.data_type === "jsonb" ? "json" : "text" })),
  ];
}

export async function runOrphanFileSweep(db: Knex, log?: FastifyBaseLogger): Promise<{ scanned: number; deleted: number }> {
  const refs = await fileReferences(db);
  let scanned = 0;
  let deleted = 0;
  const q = db("uploaded_files as f")
    .where("f.created_at", "<", db.raw(`now() - interval '${TTL_DAYS} days'`))
    .orderBy("f.created_at", "asc")
    .limit(BATCH)
    .select("f.id", "f.storage_path");
  for (const ref of refs) {
    const probe =
      ref.kind === "fk" ? db.raw(`?? = f.id`, [`${ref.table}.${ref.column}`])
      : ref.kind === "json" ? db.raw(`??::text LIKE '%' || f.id || '%'`, [`${ref.table}.${ref.column}`])
      : db.raw(`?? LIKE '%' || f.id || '%'`, [`${ref.table}.${ref.column}`]);
    q.whereNotExists(db.select(db.raw("1")).from(ref.table).whereRaw(probe));
  }
  const orphans: { id: string; storage_path: string }[] = await q;
  for (const file of orphans) {
    scanned += 1;
    try {
      await deleteStoredFile(file.storage_path);
      await db("uploaded_files").where({ id: file.id }).del();
      deleted += 1;
    } catch (err) {
      // A FK added since the scan, or storage refusing: leave it for next time.
      log?.warn({ err, fileId: file.id }, "orphan file not removed");
    }
  }
  if (scanned > 0) log?.info({ scanned, deleted, references: refs.length }, "orphan file sweep");
  return { scanned, deleted };
}

export function registerOrphanFileWorker(db: Knex, manager: QueueManager, log?: FastifyBaseLogger): void {
  manager.startRepeating<{ _tick: number }>(ORPHAN_FILE_QUEUE, INTERVAL_MS, async () => {
    await runOrphanFileSweep(db, log);
  }, { _tick: 0 });
}

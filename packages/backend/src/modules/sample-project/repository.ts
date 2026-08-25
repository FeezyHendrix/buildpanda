import type { Knex } from "knex";
import type { DeferredUpdate, SampleProjectDataset } from "./types.ts";

export interface SampleProjectWrite {
  projectId: string;
  patch: Record<string, unknown>;
  deferred: DeferredUpdate[];
}

export interface SampleProjectRepository {
  hasSampleProject(organizationId: string): Promise<boolean>;
  existingDocumentCategoryIds(): Promise<Set<string>>;
  insertDataset(dataset: SampleProjectDataset, write: SampleProjectWrite): Promise<void>;
}

export function sampleProjectRepository(db: Knex): SampleProjectRepository {
  return {
    async hasSampleProject(organizationId) {
      const row = await db("projects")
        .where({ organization_id: organizationId, is_sample: true })
        .first("id");
      return Boolean(row);
    },

    async existingDocumentCategoryIds() {
      const rows = await db<{ id: string }>("document_categories").select("id");
      return new Set(rows.map((r) => r.id));
    },

    async insertDataset(dataset, write) {
      // One transaction for the whole tree: a sample project that only half
      // exists would render as a broken project rather than no project at all.
      await db.transaction(async (trx) => {
        for (const { table, rows } of dataset) {
          if (rows.length === 0) continue;
          await trx(table).insert(rows);
        }
        await trx("project_finances")
          .where({ project_id: write.projectId })
          .update(write.patch);
        for (const update of write.deferred) {
          await trx(update.table).where(update.where).update(update.patch);
        }
      });
    },
  };
}

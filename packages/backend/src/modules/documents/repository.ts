import type { Knex } from "knex";
import type {
  CategoryAggregateRow,
  CategoryRow,
  DocumentRow,
  DocumentStatus,
} from "./types.ts";

export interface NewDocumentRecord {
  id: string;
  project_id: string;
  category_id: string | null;
  file_id: string | null;
  file_name: string;
  size: string;
  size_bytes: number | null;
  status: DocumentStatus;
  uploaded_at: string;
}

export function documentsRepository(db: Knex) {
  return {
    listByProject(projectId: string): Promise<DocumentRow[]> {
      return db<DocumentRow>("project_documents")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc");
    },

    listCategories(): Promise<CategoryRow[]> {
      return db<CategoryRow>("document_categories")
        .select("id", "name", "tone")
        .orderBy("name", "asc");
    },

    categoryCountsForProject(projectId: string): Promise<CategoryAggregateRow[]> {
      return db("document_categories as c")
        .leftJoin("project_documents as d", function () {
          this.on("d.category_id", "=", "c.id").andOn(
            db.raw("d.project_id = ?", [projectId]),
          );
        })
        .select(
          "c.id",
          "c.name",
          "c.tone",
          db.raw("COUNT(d.id)::text as file_count"),
          db.raw("STRING_AGG(d.size, ', ' ORDER BY d.created_at DESC) as total_size"),
        )
        .groupBy("c.id", "c.name", "c.tone")
        .orderBy("c.name", "asc");
    },

    findCategoryById(id: string): Promise<CategoryRow | undefined> {
      return db<CategoryRow>("document_categories").where({ id }).first();
    },

    findDocumentById(id: string): Promise<DocumentRow | undefined> {
      return db<DocumentRow>("project_documents").where({ id }).first();
    },

    async create(record: NewDocumentRecord): Promise<DocumentRow> {
      const [row] = await db<DocumentRow>("project_documents")
        .insert(record)
        .returning("*");
      if (!row) throw new Error("Failed to insert document");
      return row;
    },
  };
}

export type DocumentsRepository = ReturnType<typeof documentsRepository>;

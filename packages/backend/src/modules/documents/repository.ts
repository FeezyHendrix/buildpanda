import type { Knex } from "knex";
import type {
  CategoryAggregateRow,
  CategoryRow,
  DocumentRow,
  DocumentStatus,
  DocumentVersionRow,
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

export interface DocumentUpdatePatch {
  category_id?: string | null;
  file_name?: string;
  status?: DocumentStatus;
  file_id?: string | null;
  size?: string;
  size_bytes?: number | null;
  uploaded_at?: string;
  current_version_id?: string | null;
}

export interface NewVersionRecord {
  id: string;
  document_id: string;
  file_id: string | null;
  version_no: number;
  revision_label: string | null;
  file_name: string;
  size: string;
  size_bytes: number | null;
  notes: string | null;
  uploaded_by_id: string | null;
}

export interface VersionWithFile extends DocumentVersionRow {
  storage_path: string | null;
  mime_type: string | null;
}

export function documentsRepository(db: Knex) {
  return {
    listByProject(projectId: string): Promise<DocumentRow[]> {
      return db<DocumentRow>("project_documents")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc");
    },

    /** version counts keyed by document id, for the given project. */
    async versionCountsForProject(projectId: string): Promise<Map<string, number>> {
      const rows = await db("document_versions as v")
        .join("project_documents as d", "d.id", "v.document_id")
        .where("d.project_id", projectId)
        .groupBy("v.document_id")
        .select("v.document_id")
        .count<{ document_id: string; count: string }[]>("v.id as count");
      return new Map(rows.map((r) => [r.document_id, Number(r.count)]));
    },

    listCategories(): Promise<CategoryRow[]> {
      return db<CategoryRow>("document_categories")
        .select("id", "name", "tone", "group")
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
          "c.group",
          db.raw("COUNT(d.id)::text as file_count"),
          db.raw("STRING_AGG(d.size, ', ' ORDER BY d.created_at DESC) as total_size"),
        )
        .groupBy("c.id", "c.name", "c.tone", "c.group")
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

    async update(
      id: string,
      patch: DocumentUpdatePatch,
    ): Promise<DocumentRow | undefined> {
      const [row] = await db<DocumentRow>("project_documents")
        .where({ id })
        .update(patch)
        .returning("*");
      return row;
    },

    async deleteDocument(id: string): Promise<void> {
      await db("project_documents").where({ id }).del();
    },

    // --- Versions ---
    listVersions(documentId: string): Promise<DocumentVersionRow[]> {
      return db<DocumentVersionRow>("document_versions")
        .where({ document_id: documentId })
        .orderBy("version_no", "desc");
    },

    async nextVersionNo(documentId: string): Promise<number> {
      const row = await db("document_versions")
        .where({ document_id: documentId })
        .max<{ max: number | null }[]>("version_no as max")
        .first();
      return (row?.max ?? 0) + 1;
    },

    async createVersion(record: NewVersionRecord): Promise<DocumentVersionRow> {
      const [row] = await db("document_versions").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert document version");
      return row as DocumentVersionRow;
    },

    findVersionWithFile(
      documentId: string,
      versionId: string,
    ): Promise<VersionWithFile | undefined> {
      return db<VersionWithFile>("document_versions as v")
        .leftJoin("uploaded_files as f", "f.id", "v.file_id")
        .where({ "v.document_id": documentId, "v.id": versionId })
        .select(
          "v.*",
          "f.storage_path as storage_path",
          "f.mime_type as mime_type",
        )
        .first();
    },
  };
}

export type DocumentsRepository = ReturnType<typeof documentsRepository>;

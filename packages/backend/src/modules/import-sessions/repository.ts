import type { Knex } from "knex";
import type {
  ImportDocKind,
  ImportDocStatus,
  ImportSessionDocumentRow,
  ImportSessionRow,
} from "./types.ts";

export interface NewImportSessionRecord {
  id: string;
  project_id: string | null;
  created_by: string | null;
}

export interface NewImportDocumentRecord {
  id: string;
  session_id: string;
  kind: ImportDocKind;
  job_id?: string | null;
  file_name?: string | null;
  status: ImportDocStatus;
}

export interface ImportDocumentPatch {
  job_id?: string | null;
  file_name?: string | null;
  status?: ImportDocStatus;
  error?: string | null;
  applied_at?: string | null;
}

export function importSessionsRepository(db: Knex) {
  return {
    findById(id: string): Promise<ImportSessionRow | undefined> {
      return db("import_sessions").where({ id }).first();
    },

    async create(record: NewImportSessionRecord): Promise<ImportSessionRow> {
      await db("import_sessions").insert(record);
      const row = await this.findById(record.id);
      if (!row) throw new Error("Failed to insert import session");
      return row;
    },

    async setProjectId(id: string, projectId: string): Promise<void> {
      await db("import_sessions")
        .where({ id })
        .update({ project_id: projectId, updated_at: db.fn.now() });
    },

    async setStatus(id: string, status: ImportSessionRow["status"]): Promise<void> {
      await db("import_sessions")
        .where({ id })
        .update({ status, updated_at: db.fn.now() });
    },

    listDocuments(sessionId: string): Promise<ImportSessionDocumentRow[]> {
      return db("import_session_documents")
        .where({ session_id: sessionId })
        .orderBy("created_at", "asc");
    },

    findDocumentById(id: string): Promise<ImportSessionDocumentRow | undefined> {
      return db("import_session_documents").where({ id }).first();
    },

    async addDocument(
      record: NewImportDocumentRecord,
    ): Promise<ImportSessionDocumentRow> {
      await db("import_session_documents").insert(record);
      const row = await this.findDocumentById(record.id);
      if (!row) throw new Error("Failed to insert import document");
      return row;
    },

    async updateDocument(
      id: string,
      patch: ImportDocumentPatch,
    ): Promise<ImportSessionDocumentRow | undefined> {
      await db("import_session_documents").where({ id }).update(patch);
      return this.findDocumentById(id);
    },

    async touch(id: string): Promise<void> {
      await db("import_sessions").where({ id }).update({ updated_at: db.fn.now() });
    },
  };
}

export type ImportSessionsRepository = ReturnType<typeof importSessionsRepository>;

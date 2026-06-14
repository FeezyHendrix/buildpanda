import type { Knex } from "knex";

export interface FileShareRow {
  id: string;
  project_id: string;
  document_id: string;
  token: string;
  created_by: string | null;
  expires_at: Date | string | null;
  revoked_at: Date | string | null;
  view_count: number;
  created_at: Date | string;
}

export interface NewFileShareRecord {
  id: string;
  project_id: string;
  document_id: string;
  token: string;
  created_by: string | null;
  expires_at: string | null;
}

export interface ShareFileInfo {
  token: string;
  fileName: string;
  storagePath: string | null;
  mimeType: string | null;
  projectName: string;
  expiresAt: Date | string | null;
  revokedAt: Date | string | null;
}

export function fileSharesRepository(db: Knex) {
  return {
    async create(record: NewFileShareRecord): Promise<FileShareRow> {
      const [row] = await db<FileShareRow>("file_shares").insert(record).returning("*");
      if (!row) throw new Error("Failed to create file share");
      return row;
    },

    existingForDocument(documentId: string): Promise<FileShareRow | undefined> {
      return db<FileShareRow>("file_shares")
        .where({ document_id: documentId })
        .whereNull("revoked_at")
        .orderBy("created_at", "desc")
        .first();
    },

    listForDocument(documentId: string): Promise<FileShareRow[]> {
      return db<FileShareRow>("file_shares")
        .where({ document_id: documentId })
        .orderBy("created_at", "desc");
    },

    findById(id: string, projectId: string): Promise<FileShareRow | undefined> {
      return db<FileShareRow>("file_shares").where({ id, project_id: projectId }).first();
    },

    async revoke(id: string, projectId: string): Promise<void> {
      await db("file_shares").where({ id, project_id: projectId }).update({ revoked_at: new Date() });
    },

    byToken(token: string): Promise<ShareFileInfo | undefined> {
      return db("file_shares as s")
        .join("project_documents as d", "d.id", "s.document_id")
        .join("projects as p", "p.id", "s.project_id")
        .leftJoin("document_versions as v", "v.id", "d.current_version_id")
        .leftJoin("uploaded_files as f", "f.id", "v.file_id")
        .where("s.token", token)
        .first<ShareFileInfo>(
          "s.token",
          "d.file_name as fileName",
          "f.storage_path as storagePath",
          "f.mime_type as mimeType",
          "p.name as projectName",
          "s.expires_at as expiresAt",
          "s.revoked_at as revokedAt",
        );
    },

    async incrementView(token: string): Promise<void> {
      await db("file_shares").where({ token }).increment("view_count", 1);
    },
  };
}

export type FileSharesRepository = ReturnType<typeof fileSharesRepository>;

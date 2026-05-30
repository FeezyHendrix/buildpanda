import type { Knex } from "knex";
import type { UploadedFileRow } from "./types.ts";

export interface NewUploadedFileRecord {
  id: string;
  owner_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
}

export function filesRepository(db: Knex) {
  return {
    findById(id: string): Promise<UploadedFileRow | undefined> {
      return db<UploadedFileRow>("uploaded_files").where({ id }).first();
    },

    findByIds(ids: string[]): Promise<UploadedFileRow[]> {
      if (ids.length === 0) return Promise.resolve([]);
      return db<UploadedFileRow>("uploaded_files").whereIn("id", ids);
    },

    async create(record: NewUploadedFileRecord): Promise<UploadedFileRow> {
      const [row] = await db<UploadedFileRow>("uploaded_files").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert uploaded file");
      return row;
    },
  };
}

export type FilesRepository = ReturnType<typeof filesRepository>;

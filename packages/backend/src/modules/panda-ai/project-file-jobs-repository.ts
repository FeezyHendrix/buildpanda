import type { Knex } from "knex";
import type { ProjectExtraction } from "./project-extraction.ts";

export type ProjectFileJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "applied";

export interface ProjectFileJobRow {
  id: string;
  session_id: string | null;
  project_id: string | null;
  status: ProjectFileJobStatus;
  file_name: string;
  storage_path: string;
  extraction: ProjectExtraction | string | null;
  error: string | null;
  requested_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface NewProjectFileJobRecord {
  id: string;
  session_id: string | null;
  file_name: string;
  storage_path: string;
  requested_by: string | null;
}

export function projectFileJobsRepository(db: Knex) {
  return {
    async create(record: NewProjectFileJobRecord): Promise<ProjectFileJobRow> {
      await db("project_file_import_jobs").insert(record);
      const row = await this.rawById(record.id);
      if (!row) throw new Error("Failed to create project file import job");
      return row;
    },

    rawById(id: string): Promise<ProjectFileJobRow | undefined> {
      return db<ProjectFileJobRow>("project_file_import_jobs").where({ id }).first();
    },

    async markProcessing(id: string): Promise<void> {
      await db("project_file_import_jobs")
        .where({ id })
        .update({ status: "processing", updated_at: db.fn.now() });
    },

    async markComplete(id: string, extraction: ProjectExtraction): Promise<void> {
      await db("project_file_import_jobs")
        .where({ id })
        .update({
          status: "completed",
          extraction: JSON.stringify(extraction),
          error: null,
          updated_at: db.fn.now(),
        });
    },

    async markFailed(id: string, error: string): Promise<void> {
      await db("project_file_import_jobs")
        .where({ id })
        .update({ status: "failed", error, updated_at: db.fn.now() });
    },

    async markApplied(id: string, projectId: string): Promise<void> {
      await db("project_file_import_jobs")
        .where({ id })
        .update({ status: "applied", project_id: projectId, updated_at: db.fn.now() });
    },
  };
}

export type ProjectFileJobsRepository = ReturnType<typeof projectFileJobsRepository>;

export function parseExtraction(
  value: ProjectExtraction | string | null,
): ProjectExtraction | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as ProjectExtraction;
    } catch {
      return null;
    }
  }
  return value;
}

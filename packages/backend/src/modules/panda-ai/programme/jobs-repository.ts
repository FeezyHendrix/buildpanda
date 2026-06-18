import type { Knex } from "knex";
import type { StructuredProgramme } from "./structure.ts";

export type ProgrammeJobStatus = "pending" | "processing" | "completed" | "failed" | "applied";

export interface ProgrammeJobRow {
  id: string;
  organization_id: string | null;
  status: ProgrammeJobStatus;
  file_name: string;
  storage_path: string;
  result: StructuredProgramme | string;
  activity_count: number;
  phase_count: number;
  used_ai: boolean;
  created_project_id: string | null;
  error: string | null;
  requested_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface NewProgrammeJobRecord {
  id: string;
  organization_id: string | null;
  status: ProgrammeJobStatus;
  file_name: string;
  storage_path: string;
  requested_by: string | null;
}

export function programmeJobsRepository(db: Knex) {
  return {
    async create(record: NewProgrammeJobRecord): Promise<ProgrammeJobRow> {
      const [row] = await db<ProgrammeJobRow>("programme_import_jobs").insert(record).returning("*");
      if (!row) throw new Error("Failed to create programme import job");
      return row;
    },

    findByIdForUser(id: string, userId: string): Promise<ProgrammeJobRow | undefined> {
      return db<ProgrammeJobRow>("programme_import_jobs").where({ id, requested_by: userId }).first();
    },

    rawById(id: string): Promise<ProgrammeJobRow | undefined> {
      return db<ProgrammeJobRow>("programme_import_jobs").where({ id }).first();
    },

    async markProcessing(id: string): Promise<void> {
      await db("programme_import_jobs").where({ id }).update({ status: "processing", updated_at: new Date() });
    },

    async markComplete(id: string, result: StructuredProgramme): Promise<void> {
      await db("programme_import_jobs").where({ id }).update({
        status: "completed",
        result: JSON.stringify(result),
        activity_count: result.activities.length,
        phase_count: result.phases.length,
        used_ai: result.usedAi,
        error: null,
        updated_at: new Date(),
      });
    },

    async markApplied(id: string, projectId: string): Promise<void> {
      await db("programme_import_jobs").where({ id }).update({
        status: "applied",
        created_project_id: projectId,
        updated_at: new Date(),
      });
    },

    async markFailed(id: string, error: string): Promise<void> {
      await db("programme_import_jobs").where({ id }).update({ status: "failed", error, updated_at: new Date() });
    },
  };
}

export type ProgrammeJobsRepository = ReturnType<typeof programmeJobsRepository>;

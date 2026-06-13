import type { Knex } from "knex";
import type { ParsedMaterial } from "./boq-import.ts";

export type BoqJobStatus = "pending" | "processing" | "completed" | "failed";

export interface BoqJobRow {
  id: string;
  project_id: string;
  status: BoqJobStatus;
  file_name: string;
  storage_path: string;
  materials: ParsedMaterial[] | string;
  material_count: number;
  used_ai: boolean;
  error: string | null;
  requested_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface NewBoqJobRecord {
  id: string;
  project_id: string;
  status: BoqJobStatus;
  file_name: string;
  storage_path: string;
  requested_by: string | null;
}

export function boqJobsRepository(db: Knex) {
  return {
    async create(record: NewBoqJobRecord): Promise<BoqJobRow> {
      const [row] = await db<BoqJobRow>("boq_import_jobs").insert(record).returning("*");
      if (!row) throw new Error("Failed to create BoQ import job");
      return row;
    },

    findById(id: string, projectId: string): Promise<BoqJobRow | undefined> {
      return db<BoqJobRow>("boq_import_jobs").where({ id, project_id: projectId }).first();
    },

    rawById(id: string): Promise<BoqJobRow | undefined> {
      return db<BoqJobRow>("boq_import_jobs").where({ id }).first();
    },

    async markProcessing(id: string): Promise<void> {
      await db("boq_import_jobs").where({ id }).update({ status: "processing", updated_at: new Date() });
    },

    async markComplete(id: string, materials: ParsedMaterial[], usedAi: boolean): Promise<void> {
      await db("boq_import_jobs").where({ id }).update({
        status: "completed",
        materials: JSON.stringify(materials),
        material_count: materials.length,
        used_ai: usedAi,
        error: null,
        updated_at: new Date(),
      });
    },

    async markFailed(id: string, error: string): Promise<void> {
      await db("boq_import_jobs").where({ id }).update({ status: "failed", error, updated_at: new Date() });
    },
  };
}

export type BoqJobsRepository = ReturnType<typeof boqJobsRepository>;

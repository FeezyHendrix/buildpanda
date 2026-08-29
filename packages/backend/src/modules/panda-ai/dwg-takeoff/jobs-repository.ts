import type { Knex } from "knex";
import type { TakeoffJobRow, TakeoffResult, TakeoffStatus } from "./types.ts";

export interface NewTakeoffJobRecord {
  id: string;
  project_id?: string | null;
  proposal_id?: string | null;
  file_id?: string | null;
  status: TakeoffStatus;
  file_name: string;
  storage_path: string;
  requested_by: string | null;
}

export function takeoffJobsRepository(db: Knex) {
  return {
    async create(record: NewTakeoffJobRecord): Promise<TakeoffJobRow> {
      const [row] = await db<TakeoffJobRow>("takeoff_jobs").insert(record).returning("*");
      if (!row) throw new Error("Failed to create take-off job");
      return row;
    },

    findById(id: string, projectId: string): Promise<TakeoffJobRow | undefined> {
      return db<TakeoffJobRow>("takeoff_jobs").where({ id, project_id: projectId }).first();
    },

    findByIdForProposal(id: string, proposalId: string): Promise<TakeoffJobRow | undefined> {
      return db<TakeoffJobRow>("takeoff_jobs").where({ id, proposal_id: proposalId }).first();
    },

    rawById(id: string): Promise<TakeoffJobRow | undefined> {
      return db<TakeoffJobRow>("takeoff_jobs").where({ id }).first();
    },

    listByProject(projectId: string): Promise<TakeoffJobRow[]> {
      return db<TakeoffJobRow>("takeoff_jobs")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc");
    },

    listByProposal(proposalId: string): Promise<TakeoffJobRow[]> {
      return db<TakeoffJobRow>("takeoff_jobs")
        .where({ proposal_id: proposalId })
        .orderBy("created_at", "desc");
    },

    async markProcessing(id: string): Promise<void> {
      await db("takeoff_jobs")
        .where({ id })
        .update({ status: "processing", started_at: new Date(), updated_at: new Date() });
    },

    async markComplete(id: string, result: TakeoffResult): Promise<void> {
      await db("takeoff_jobs")
        .where({ id })
        .update({
          status: "completed",
          result: JSON.stringify(result),
          drawing_count: result.drawings.length,
          element_count: result.items.length,
          error: null,
          completed_at: new Date(),
          updated_at: new Date(),
        });
    },

    async markFailed(id: string, error: string): Promise<void> {
      await db("takeoff_jobs")
        .where({ id })
        .update({ status: "failed", error, completed_at: new Date(), updated_at: new Date() });
    },
  };
}

export type TakeoffJobsRepository = ReturnType<typeof takeoffJobsRepository>;

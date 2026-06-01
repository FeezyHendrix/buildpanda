import type { Knex } from "knex";
import type { RiskFactorRow } from "./types.ts";
import type { RiskLevel } from "../projects/types.ts";

export interface NewRiskFactorRecord {
  id: string;
  project_id: string;
  title: string;
  description: string;
  severity: RiskLevel;
}

export interface RiskFactorUpdatePatch {
  title?: string;
  description?: string;
  severity?: RiskLevel;
}

export function risksRepository(db: Knex) {
  return {
    listByProject(projectId: string): Promise<RiskFactorRow[]> {
      return db<RiskFactorRow>("risk_factors")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc");
    },

    findById(id: string): Promise<RiskFactorRow | undefined> {
      return db<RiskFactorRow>("risk_factors").where({ id }).first();
    },

    async create(record: NewRiskFactorRecord): Promise<RiskFactorRow> {
      const [row] = await db<RiskFactorRow>("risk_factors")
        .insert(record)
        .returning("*");
      if (!row) throw new Error("Failed to insert risk factor");
      return row;
    },

    async update(
      id: string,
      patch: RiskFactorUpdatePatch,
    ): Promise<RiskFactorRow | undefined> {
      const [row] = await db<RiskFactorRow>("risk_factors")
        .where({ id })
        .update(patch)
        .returning("*");
      return row;
    },

    async deleteRiskFactor(id: string): Promise<void> {
      await db("risk_factors").where({ id }).delete();
    },
  };
}

export type RisksRepository = ReturnType<typeof risksRepository>;

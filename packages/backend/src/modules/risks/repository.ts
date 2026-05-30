import type { Knex } from "knex";
import type { RiskFactorRow } from "./types.ts";

export function risksRepository(db: Knex) {
  return {
    listByProject(projectId: string): Promise<RiskFactorRow[]> {
      return db<RiskFactorRow>("risk_factors")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc");
    },
  };
}

export type RisksRepository = ReturnType<typeof risksRepository>;

import type { RisksRepository } from "./repository.ts";
import type { RiskFactor, RiskFactorRow } from "./types.ts";

function toRiskFactor(row: RiskFactorRow): RiskFactor {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    severity: row.severity,
  };
}

export function risksService(repository: RisksRepository) {
  return {
    async listByProject(projectId: string): Promise<RiskFactor[]> {
      const rows = await repository.listByProject(projectId);
      return rows.map(toRiskFactor);
    },
  };
}

export type RisksService = ReturnType<typeof risksService>;

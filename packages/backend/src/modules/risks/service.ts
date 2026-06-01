import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { RisksRepository } from "./repository.ts";
import type { RiskFactor, RiskFactorRow } from "./types.ts";
import type { RiskLevel } from "../projects/types.ts";

export interface CreateRiskInput {
  title: string;
  description: string;
  severity: RiskLevel;
}

export interface EditRiskInput {
  title?: string;
  description?: string;
  severity?: RiskLevel;
}

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

    async create(projectId: string, input: CreateRiskInput): Promise<RiskFactor> {
      const row = await repository.create({
        id: generateId("risk"),
        project_id: projectId,
        title: input.title,
        description: input.description,
        severity: input.severity,
      });
      return toRiskFactor(row);
    },

    async edit(
      projectId: string,
      riskId: string,
      input: EditRiskInput,
    ): Promise<RiskFactor> {
      const existing = await repository.findById(riskId);
      if (!existing || existing.project_id !== projectId) {
        throw new NotFoundError("Risk factor");
      }

      const patch: Parameters<typeof repository.update>[1] = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.severity !== undefined) patch.severity = input.severity;

      const updated = await repository.update(riskId, patch);
      if (!updated) throw new NotFoundError("Risk factor");
      return toRiskFactor(updated);
    },

    async remove(projectId: string, riskId: string): Promise<void> {
      const existing = await repository.findById(riskId);
      if (!existing || existing.project_id !== projectId) {
        throw new NotFoundError("Risk factor");
      }
      await repository.deleteRiskFactor(riskId);
    },
  };
}

export type RisksService = ReturnType<typeof risksService>;

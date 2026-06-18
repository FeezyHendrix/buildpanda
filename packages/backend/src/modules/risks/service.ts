import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { Knex } from "knex";
import type { RisksRepository } from "./repository.ts";
import type { RiskFactor, RiskFactorRow } from "./types.ts";
import type { RiskLevel } from "../projects/types.ts";
import type { NotificationsService } from "../notifications/service.ts";

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

export interface RisksDeps {
  db?: Knex;
  notifications?: NotificationsService;
}

function toRiskFactor(row: RiskFactorRow): RiskFactor {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    severity: row.severity,
  };
}

async function notifyHighRisk(
  deps: RisksDeps,
  projectId: string,
  title: string,
): Promise<void> {
  if (!deps.notifications || !deps.db) return;
  const project = await deps.db("projects")
    .select("owner_id")
    .where({ id: projectId })
    .first<{ owner_id: string | null }>();
  if (!project?.owner_id) return;
  void deps.notifications
    .notify(project.owner_id, "risk_high_added", {
      title: "A high-severity risk was added",
      body: title,
      projectId,
    })
    .catch(() => undefined);
}

export function risksService(repository: RisksRepository, deps: RisksDeps = {}) {
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
      if (input.severity === "High") {
        await notifyHighRisk(deps, projectId, input.title);
      }
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
      if (input.severity === "High" && existing.severity !== "High") {
        await notifyHighRisk(deps, projectId, updated.title);
      }
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

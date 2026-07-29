import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { BuildingsRepository, BuildingUpdatePatch } from "./repository.ts";
import type { Building, BuildingRow, BuildingStatus } from "./types.ts";

export interface CreateBuildingInput {
  name: string;
  code?: string | null;
  status?: BuildingStatus;
  progressPercent?: number;
}

export interface UpdateBuildingInput {
  name?: string;
  code?: string | null;
  status?: BuildingStatus;
  progressPercent?: number;
}

function clampPercent(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toBuilding(row: BuildingRow): Building {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    code: row.code,
    kind: row.kind,
    status: row.status,
    progressPercent: row.progress_percent,
    sortOrder: row.sort_order,
  };
}

export function buildingsService(repository: BuildingsRepository) {
  return {
    async list(projectId: string): Promise<Building[]> {
      const [rows, stageProgress] = await Promise.all([
        repository.listByProject(projectId),
        repository.stageProgressByBuilding(projectId),
      ]);
      return rows.map((row) => {
        const building = toBuilding(row);
        const rolledUp = stageProgress.get(row.id);
        return rolledUp === undefined ? building : { ...building, progressPercent: rolledUp };
      });
    },

    async create(projectId: string, input: CreateBuildingInput): Promise<Building> {
      const sortOrder = await repository.nextSortOrder(projectId);
      const row = await repository.create({
        id: generateId("bld"),
        project_id: projectId,
        name: input.name,
        code: input.code ?? null,
        status: input.status ?? "active",
        sort_order: sortOrder,
        progress_percent: clampPercent(input.progressPercent, 0),
      });
      return toBuilding(row);
    },

    async update(
      projectId: string,
      buildingId: string,
      input: UpdateBuildingInput,
    ): Promise<Building> {
      const existing = await repository.findById(buildingId);
      if (!existing || existing.project_id !== projectId || existing.kind !== "real") {
        throw new NotFoundError("Building not found");
      }
      const patch: BuildingUpdatePatch = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.code !== undefined) patch.code = input.code;
      if (input.status !== undefined) patch.status = input.status;
      if (input.progressPercent !== undefined) {
        patch.progress_percent = clampPercent(input.progressPercent, existing.progress_percent);
      }
      const row = await repository.update(buildingId, patch);
      if (!row) throw new NotFoundError("Building not found");
      return toBuilding(row);
    },

    async remove(projectId: string, buildingId: string): Promise<void> {
      const existing = await repository.findById(buildingId);
      if (!existing || existing.project_id !== projectId || existing.kind !== "real") {
        throw new NotFoundError("Building not found");
      }
      await repository.remove(buildingId);
    },

    reorder(projectId: string, orderedIds: string[]): Promise<void> {
      return repository.reorder(projectId, orderedIds);
    },

    async cloneProgramme(
      projectId: string,
      toBuildingId: string,
      fromBuildingId: string,
    ): Promise<{ clonedStages: number }> {
      const [target, source] = await Promise.all([
        repository.findById(toBuildingId),
        repository.findById(fromBuildingId),
      ]);
      if (!target || target.project_id !== projectId || target.kind !== "real") {
        throw new NotFoundError("Target building not found");
      }
      if (!source || source.project_id !== projectId || source.kind !== "real") {
        throw new NotFoundError("Source building not found");
      }
      const clonedStages = await repository.cloneStages(
        projectId,
        fromBuildingId,
        toBuildingId,
        () => generateId("stage"),
      );
      return { clonedStages };
    },
  };
}

export type BuildingsService = ReturnType<typeof buildingsService>;

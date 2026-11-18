import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { BuildingPhasesRepository } from "./repository.ts";
import {
  BUILDING_PHASE_NAME_MAX,
  type BuildingPhase,
  type BuildingPhaseDeps,
  type BuildingPhaseProgress,
  type BuildingPhaseRow,
  type CreateBuildingPhaseBody,
  type PhaseStageRow,
} from "./types.ts";

/** Completed when every stage is done, Not started when none has begun (or there are none). */
export function phaseProgress(stages: PhaseStageRow[]): BuildingPhaseProgress {
  const stageCount = stages.length;
  if (stageCount === 0) return { stageCount, progressPercent: 0, status: "Not started" };
  const progressPercent = Math.round(
    stages.reduce((sum, stage) => sum + stage.progress_percent, 0) / stageCount,
  );
  const status = stages.every((stage) => stage.status === "Done")
    ? "Completed"
    : stages.every((stage) => stage.status === "Pending")
      ? "Not started"
      : "In Progress";
  return { stageCount, progressPercent, status };
}

function toBuildingPhase(row: BuildingPhaseRow, stages: PhaseStageRow[]): BuildingPhase {
  return {
    id: row.id,
    projectId: row.project_id,
    buildingId: row.building_id,
    name: row.name,
    sortOrder: row.sort_order,
    ...phaseProgress(stages),
  };
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > BUILDING_PHASE_NAME_MAX) {
    throw new BadRequestError(`Phase name must be 1 to ${BUILDING_PHASE_NAME_MAX} characters`);
  }
  return trimmed;
}

// The unique index (project, building, lower(name)) is the duplicate check, so
// two concurrent creates cannot both pass.
async function rejectDuplicate<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new BadRequestError("A phase with this name already exists");
    }
    throw error;
  }
}

export function buildingPhasesService(repository: BuildingPhasesRepository, deps: BuildingPhaseDeps) {
  async function stagesOf(projectId: string, phaseId: string): Promise<PhaseStageRow[]> {
    return (await deps.stagesForProject(projectId)).filter((stage) => stage.building_phase_id === phaseId);
  }

  async function owned(projectId: string, phaseId: string): Promise<BuildingPhaseRow> {
    const row = await repository.findById(phaseId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Building phase");
    return row;
  }

  return {
    async list(projectId: string, buildingId?: string): Promise<BuildingPhase[]> {
      const [rows, stages] = await Promise.all([
        repository.listByProject(projectId, buildingId),
        deps.stagesForProject(projectId),
      ]);
      return rows.map((row) =>
        toBuildingPhase(row, stages.filter((stage) => stage.building_phase_id === row.id)),
      );
    },

    async create(projectId: string, userId: string, input: CreateBuildingPhaseBody): Promise<BuildingPhase> {
      const name = cleanName(input.name);
      const buildingId = input.buildingId ?? (await deps.soleRealBuildingId(projectId));
      if (!buildingId) throw new BadRequestError("buildingId is required for a multi-building project");
      if (!(await deps.buildingBelongsToProject(projectId, buildingId))) {
        throw new BadRequestError("Building does not belong to this project");
      }
      const row = await rejectDuplicate(
        repository.create({
          id: generateId("bphase"),
          project_id: projectId,
          building_id: buildingId,
          name,
          sort_order: await repository.nextSortOrder(projectId, buildingId),
          created_by: userId,
        }),
      );
      return toBuildingPhase(row, []);
    },

    async rename(projectId: string, phaseId: string, rawName: string): Promise<BuildingPhase> {
      const name = cleanName(rawName);
      await owned(projectId, phaseId);
      const row = await rejectDuplicate(repository.rename(phaseId, name));
      if (!row) throw new NotFoundError("Building phase");
      return toBuildingPhase(row, await stagesOf(projectId, phaseId));
    },

    /** A phase that still holds stages is blocked, not emptied: the PM moves them first. */
    async remove(projectId: string, phaseId: string): Promise<void> {
      await owned(projectId, phaseId);
      const stageCount = (await stagesOf(projectId, phaseId)).length;
      if (stageCount > 0) {
        throw new ConflictError(
          `Phase has ${stageCount} ${stageCount === 1 ? "stage" : "stages"}. Move them to another phase first`,
          { stageCount },
        );
      }
      await repository.remove(phaseId);
    },
  };
}

export type BuildingPhasesService = ReturnType<typeof buildingPhasesService>;

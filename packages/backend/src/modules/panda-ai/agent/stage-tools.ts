import { buildingPhasesRepository } from "../../building-phases/repository.ts";
import { phaseProgress } from "../../building-phases/service.ts";
import { stagesRepository } from "../../stages/repository.ts";
import type { StageRow } from "../../stages/types.ts";
import { fn, tool, type AgentTool } from "./tool-helpers.ts";

function stageLine(stage: StageRow) {
  return {
    name: stage.name,
    status: stage.status,
    progressPercent: stage.progress_percent,
    dateRange: stage.date_range,
  };
}

/** Read tools over how the build stages are grouped on the Stages page. */
export function stageTools(): AgentTool[] {
  return [
    tool(
      fn(
        "get_building_phases",
        "Get the project's building phases: the groups the build stages are organised under on the Build Stages page (for example Pre-Construction, Sub-structure, Services, MEP, Finishes). Returns each phase's stage count, progress percent and status (Completed, In Progress, Not started, all derived from its stages) with the stages inside it, plus any stages not yet assigned to a phase. Use for 'how far along is the sub-structure phase', 'which phases are complete', 'what stages are in Finishes', or 'which stages have no phase'. For activities and dates on the programme use get_schedule.",
      ),
      async (ctx) => {
        const [phases, stages] = await Promise.all([
          buildingPhasesRepository(ctx.db).listByProject(ctx.projectId),
          stagesRepository(ctx.db).listByProject(ctx.projectId),
        ]);
        return {
          output: {
            buildingPhases: phases.map((phase) => {
              const own = stages.filter((stage) => stage.building_phase_id === phase.id);
              return {
                name: phase.name,
                buildingId: phase.building_id,
                ...phaseProgress(own),
                stages: own.map(stageLine),
              };
            }),
            unassignedStages: stages.filter((stage) => !stage.building_phase_id).map(stageLine),
          },
        };
      },
    ),
  ];
}

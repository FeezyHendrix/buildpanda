import { generateId } from "../../lib/ids.ts";
import type { CurrencyCode } from "../../lib/currencies.ts";
import { BadRequestError } from "../../lib/errors.ts";
import type {
  NewPhaseRecord,
  NewProjectBuildingRecord,
  NewProjectRecord,
  TaskSeed,
} from "./repository.ts";
import { findTemplate, stageDateRanges, type ProjectTemplate } from "./templates.ts";
import { toProjectTypeCode } from "./project-type.ts";
import type { CreateProjectInput } from "./types.ts";

/**
 * Template stages → project phases with relative "Weeks X – Y" range labels.
 * Projects carry no start date at creation, so concrete start/end dates stay
 * null for the PM to set on the schedule page.
 */
function templatePhases(projectId: string, template: ProjectTemplate): NewPhaseRecord[] {
  const ranges = stageDateRanges(template.stages);
  return template.stages.map((stage, idx) => ({
    id: generateId("phase"),
    project_id: projectId,
    building_id: "",
    name: stage.name,
    status: "Pending",
    date_range: ranges[idx]!,
    sort_order: idx,
  }));
}

const TEMPLATE_BOARD_COLUMNS = [
  { name: "To Do", status: "Todo" },
  { name: "Doing", status: "Doing" },
  { name: "Done", status: "Done" },
] as const;

/**
 * Default board (same shape as the tasks module's lazily-created one) with
 * the template's starter tasks in the "To Do" column, in stage order.
 */
function templateTaskSeed(
  projectId: string,
  buildingId: string,
  template: ProjectTemplate,
  ownerId: string | null,
): TaskSeed {
  const boardId = generateId("board");
  const columns = TEMPLATE_BOARD_COLUMNS.map((col, idx) => ({
    id: generateId("tcol"),
    board_id: boardId,
    name: col.name,
    status: col.status,
    position: idx,
  }));
  const todoColumnId = columns[0]!.id;
  const tasks = template.stages.flatMap((stage) =>
    stage.tasks.map((title) => ({ title, stageName: stage.name })),
  );
  return {
    board: {
      id: boardId,
      project_id: projectId,
      building_id: buildingId,
      name: "Tasks",
      is_default: true,
      created_by_id: ownerId,
    },
    columns,
    tasks: tasks.map((task, idx) => ({
      id: generateId("task"),
      project_id: projectId,
      building_id: buildingId,
      board_id: boardId,
      column_id: todoColumnId,
      title: task.title,
      description: `Stage: ${task.stageName}`,
      description_html: null,
      assignee_id: null,
      assignee_team_member_id: null,
      due_date: null,
      priority: "Medium",
      labels: JSON.stringify([]),
      position: idx,
      source_type: "template",
      source_id: template.id,
      created_by_id: ownerId,
    })),
  };
}

export function buildCreate(
  input: CreateProjectInput,
  ownerId: string | null,
  organizationId: string | null,
): {
  project: NewProjectRecord;
  buildings: NewProjectBuildingRecord[];
  phases: NewPhaseRecord[];
  financesCurrency: CurrencyCode;
  taskSeed?: TaskSeed;
} {
  const projectId = generateId("prj");
  const realBuildingId = generateId("bld");
  const address = `${input.location.city}, ${input.location.state}`;

  const project: NewProjectRecord = {
    id: projectId,
    owner_id: ownerId,
    organization_id: organizationId,
    name: input.title,
    address,
    status: "On Track",
    health_score: 0,
    risk: "Low",
    progress_percent: 0,
    budget_total: input.details.budgetMax,
    budget_used: 0,
    currency: input.details.currency,
    pending_approvals: 0,
    folder_tone: "orange",
    budget_min: input.details.budgetMin,
    budget_max: input.details.budgetMax,
    project_type: toProjectTypeCode(input.projectType),
    setup: {
      projectType: input.projectType,
      location: input.location,
      buildingType: input.details.buildingType,
      timeline: input.details.timeline,
      fundingMethod: input.details.fundingMethod,
      involvementLevel: input.management.involvementLevel,
      riskOptions: input.management.riskOptions,
    },
  };

  const buildings: NewProjectBuildingRecord[] = [
    {
      id: realBuildingId,
      project_id: projectId,
      name: input.title,
      kind: "real",
      status: "active",
      sort_order: 0,
      progress_percent: 0,
    },
    {
      id: `bld_shared_${projectId}`,
      project_id: projectId,
      name: "Shared",
      kind: "shared",
      status: "active",
      sort_order: -1,
      progress_percent: 0,
    },
  ];

  const template = input.templateId ? findTemplate(input.templateId) : undefined;
  if (input.templateId && !template) {
    throw new BadRequestError("Unknown project template.");
  }

  // Blank means blank. "Start from scratch" used to seed seven house stages —
  // a road job then opened onto Foundation, Superstructure and Finishes, and
  // the PM's first act was 21 clicks of deletion.
  const phases: NewPhaseRecord[] = template ? templatePhases(projectId, template) : [];

  for (const phase of phases) phase.building_id = realBuildingId;

  const taskSeed = template ? templateTaskSeed(projectId, realBuildingId, template, ownerId) : undefined;

  return { project, buildings, phases, financesCurrency: input.details.currency, taskSeed };
}


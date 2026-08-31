import { generateId } from "../../lib/ids.ts";
import type { CurrencyCode } from "../../lib/currencies.ts";
import { toIso } from "../../lib/dates.ts";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import {
  assertCanAccessProject,
  assertCanDeleteProject,
  assertCanModifyProject,
  type AccessContext,
} from "../../lib/authorization.ts";
import type {
  NewPhaseRecord,
  NewProjectBuildingRecord,
  NewProjectRecord,
  ProjectsRepository,
  TaskSeed,
} from "./repository.ts";
import { findTemplate, stageDateRanges, type ProjectTemplate } from "./templates.ts";
import type {
  CreateProjectInput,
  Project,
  ProjectPhase,
  ProjectPhaseRow,
  ProjectRow,
  UpdateProjectBudgetInput,
} from "./types.ts";

const DEFAULT_PHASES: ReadonlyArray<Pick<NewPhaseRecord, "name" | "date_range">> = [
  { name: "Site Survey & Soil Testing", date_range: "Weeks 1 – 2" },
  { name: "Permitting & Approvals", date_range: "Weeks 3 – 8" },
  { name: "Foundation & Substructure", date_range: "Weeks 9 – 16" },
  { name: "Superstructure & MEP", date_range: "Weeks 17 – 32" },
  { name: "Finishing", date_range: "Weeks 33 – 42" },
  { name: "External Works", date_range: "Weeks 43 – 46" },
  { name: "Testing & Handover", date_range: "Weeks 47 – 48" },
];

const RENOVATION_PHASES: ReadonlyArray<Pick<NewPhaseRecord, "name" | "date_range">> = [
  { name: "Existing Condition Survey", date_range: "Weeks 1 – 2" },
  { name: "Scope Confirmation & Approvals", date_range: "Weeks 3 – 4" },
  { name: "Demolition & Strip-out", date_range: "Weeks 5 – 6" },
  { name: "Structural & MEP Adjustments", date_range: "Weeks 7 – 12" },
  { name: "Interior Build-out", date_range: "Weeks 13 – 20" },
  { name: "Finishes, Fixtures & Joinery", date_range: "Weeks 21 – 26" },
  { name: "Snagging, Testing & Handover", date_range: "Weeks 27 – 28" },
];

function phasesForProjectType(
  projectType: string,
): ReadonlyArray<Pick<NewPhaseRecord, "name" | "date_range">> {
  return projectType === "renovate" ? RENOVATION_PHASES : DEFAULT_PHASES;
}

function toPhase(row: ProjectPhaseRow): ProjectPhase {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    dateRange: row.date_range ?? "",
  };
}

function toProject(row: ProjectRow, phases: ProjectPhaseRow[]): Project {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    address: row.address,
    status: row.status,
    healthScore: row.health_score,
    risk: row.risk,
    progressPercent: row.progress_percent,
    budgetTotal: Number(row.budget_total),
    budgetUsed: Number(row.budget_used),
    budgetMin: row.budget_min === null ? null : Number(row.budget_min),
    budgetMax: row.budget_max === null ? null : Number(row.budget_max),
    currency: row.currency,
    pendingApprovals: row.pending_approvals,
    nextInspection: {
      type: row.next_inspection_type ?? "",
      date: row.next_inspection_date ?? "",
    },
    folderTone: row.folder_tone,
    updatedAt: toIso(row.updated_at),
    createdAt: toIso(row.created_at),
    timeline: phases.map(toPhase),
  };
}

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

function buildCreate(
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

  const phases: NewPhaseRecord[] = template
    ? templatePhases(projectId, template)
    : phasesForProjectType(input.projectType).map((phase, idx) => ({
        id: generateId("phase"),
        project_id: projectId,
        building_id: realBuildingId,
        name: phase.name,
        status: "Pending",
        date_range: phase.date_range,
        sort_order: idx,
      }));

  for (const phase of phases) phase.building_id = realBuildingId;

  const taskSeed = template ? templateTaskSeed(projectId, realBuildingId, template, ownerId) : undefined;

  return { project, buildings, phases, financesCurrency: input.details.currency, taskSeed };
}

export function projectsService(repository: ProjectsRepository) {
  return {
    async listForUser(
      ownerId: string,
      orgRoles: ReadonlyMap<string, string>,
    ): Promise<Project[]> {
      const rows = await repository.listForUser(ownerId, orgRoles);
      if (rows.length === 0) return [];
      const phases = await repository.findPhasesByProjects(rows.map((r) => r.id));
      const grouped = new Map<string, ProjectPhaseRow[]>();
      for (const phase of phases) {
        const list = grouped.get(phase.project_id) ?? [];
        list.push(phase);
        grouped.set(phase.project_id, list);
      }
      return rows.map((row) => toProject(row, grouped.get(row.id) ?? []));
    },

    async getById(id: string): Promise<Project> {
      const row = await repository.findById(id);
      if (!row) throw new NotFoundError("Project");
      const phases = await repository.findPhasesByProject(id);
      return toProject(row, phases);
    },

    async getByIdForUser(id: string, ctx: AccessContext): Promise<Project> {
      const row = await repository.findById(id);
      if (!row) throw new NotFoundError("Project");
      assertCanAccessProject(
        { id: row.id, ownerId: row.owner_id, organizationId: row.organization_id },
        ctx,
      );
      const phases = await repository.findPhasesByProject(id);
      return toProject(row, phases);
    },

    async create(
      input: CreateProjectInput,
      ownerId: string | null,
      organizationId: string | null,
    ): Promise<Project> {
      const { project, buildings, phases, financesCurrency, taskSeed } = buildCreate(
        input,
        ownerId,
        organizationId,
      );
      await repository.create(
        project,
        buildings,
        phases,
        {
      project_id: project.id,
      currency: financesCurrency,
      total_budget: project.budget_total,
      amount_paid_to_date: 0,
      contract_sum: project.budget_total,
      variations_total: 0,
      certified_gross_to_date: 0,
    },
        taskSeed,
      );
      return this.getById(project.id);
    },

    async updateBudgetForUser(
      id: string,
      input: UpdateProjectBudgetInput,
      ctx: AccessContext,
    ): Promise<Project> {
      const row = await repository.findById(id);
      if (!row) throw new NotFoundError("Project");
      assertCanModifyProject(
        { ownerId: row.owner_id, organizationId: row.organization_id },
        ctx,
      );
      await repository.update(id, {
        budget_min: input.budgetMin,
        budget_max: input.budgetMax,
        budget_total: input.budgetMax,
        ...(input.currency ? { currency: input.currency } : {}),
      });
      return this.getById(id);
    },

    async updateSettings(id: string, settings: { aiUpdatesEnabled: boolean }): Promise<void> {
      await repository.update(id, { ai_updates_enabled: settings.aiUpdatesEnabled });
    },

    async updateCurrencyForUser(
      id: string,
      currency: CurrencyCode,
      ctx: AccessContext,
    ): Promise<Project> {
      const row = await repository.findById(id);
      if (!row) throw new NotFoundError("Project");
      assertCanModifyProject(
        { ownerId: row.owner_id, organizationId: row.organization_id },
        ctx,
      );
      await repository.updateCurrency(id, currency);
      return this.getById(id);
    },

    async deleteForUser(id: string, ctx: AccessContext): Promise<void> {
      const row = await repository.findById(id);
      if (!row) throw new NotFoundError("Project");
      assertCanDeleteProject(
        { id: row.id, ownerId: row.owner_id, organizationId: row.organization_id },
        ctx,
      );
      await repository.delete(id);
    },
  };
}

export type ProjectsService = ReturnType<typeof projectsService>;

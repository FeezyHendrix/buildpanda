import { generateId } from "../../lib/ids.ts";
import { NotFoundError } from "../../lib/errors.ts";
import {
  assertCanAccessProject,
  assertCanModifyProject,
  type AccessContext,
} from "../../lib/authorization.ts";
import type {
  NewPhaseRecord,
  NewProjectRecord,
  ProjectsRepository,
} from "./repository.ts";
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

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
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

function buildCreate(
  input: CreateProjectInput,
  ownerId: string,
  organizationId: string | null,
): { project: NewProjectRecord; phases: NewPhaseRecord[]; financesCurrency: "NGN" | "USD" } {
  const projectId = generateId("prj");
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

  const phases: NewPhaseRecord[] = DEFAULT_PHASES.map((phase, idx) => ({
    id: generateId("phase"),
    project_id: projectId,
    name: phase.name,
    status: "Pending",
    date_range: phase.date_range,
    sort_order: idx,
  }));

  return { project, phases, financesCurrency: input.details.currency };
}

export function projectsService(repository: ProjectsRepository) {
  return {
    async listForOwner(ownerId: string, orgIds: string[]): Promise<Project[]> {
      const rows = await repository.listForOwner(ownerId, orgIds);
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
        { ownerId: row.owner_id, organizationId: row.organization_id },
        ctx,
      );
      const phases = await repository.findPhasesByProject(id);
      return toProject(row, phases);
    },

    async create(
      input: CreateProjectInput,
      ownerId: string,
      organizationId: string | null,
    ): Promise<Project> {
      const { project, phases, financesCurrency } = buildCreate(input, ownerId, organizationId);
      await repository.create(project, phases, {
        project_id: project.id,
        currency: financesCurrency,
        total_budget: project.budget_total,
        funds_deposited: 0,
        funds_released: 0,
        locked_in_escrow: 0,
        remaining_balance: project.budget_total,
      });
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
  };
}

export type ProjectsService = ReturnType<typeof projectsService>;

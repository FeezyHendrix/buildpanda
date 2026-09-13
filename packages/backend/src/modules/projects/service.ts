import type { CurrencyCode } from "../../lib/currencies.ts";
import { toIso } from "../../lib/dates.ts";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import {
  assertCanAccessProject,
  assertCanDeleteProject,
  assertCanModifyProject,
  type AccessContext,
} from "../../lib/authorization.ts";
import { toCalendar } from "../../lib/working-days.ts";
import type { ProjectsRepository, ProjectUpdatePatch } from "./repository.ts";
import { buildCreate } from "./create.ts";
import type {
  CreateProjectInput,
  Project,
  ProjectPhase,
  ProjectPhaseRow,
  ProjectProfile,
  ProjectRow,
  ProjectSettings,
  UpdateProjectBudgetInput,
  UpdateProjectProfileInput,
} from "./types.ts";

function toProfile(row: ProjectRow): ProjectProfile {
  const calendar = toCalendar(row.working_days, row.holidays);
  return {
    name: row.name,
    address: row.address,
    startDate: row.start_date,
    completionDate: row.completion_date,
    revisedCompletionDate: row.revised_completion_date,
    clientName: row.client_name,
    contractorEntity: row.contractor_entity,
    projectType: row.project_type,
    workingDays: [...calendar.workingDays],
    holidays: [...calendar.holidays],
    aiUpdateCadence: row.ai_update_cadence,
  };
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

    async updateSettings(id: string, settings: ProjectSettings): Promise<void> {
      await repository.update(id, { ai_update_cadence: settings.aiUpdateCadence });
    },

    async getProfile(id: string): Promise<ProjectProfile> {
      const row = await repository.findById(id);
      if (!row) throw new NotFoundError("Project");
      return toProfile(row);
    },

    /**
     * The project record a PM actually manages against: contract dates, the
     * parties, and the working calendar every "days missed" and duration figure
     * on the app is counted on.
     */
    async updateProfile(id: string, input: UpdateProjectProfileInput): Promise<ProjectProfile> {
      const row = await repository.findById(id);
      if (!row) throw new NotFoundError("Project");
      const start = input.startDate !== undefined ? input.startDate : row.start_date;
      const completion =
        input.completionDate !== undefined ? input.completionDate : row.completion_date;
      if (start && completion && start > completion) {
        throw new BadRequestError("Completion date must be on or after the start date");
      }

      const patch: ProjectUpdatePatch = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.address !== undefined) patch.address = input.address;
      if (input.startDate !== undefined) patch.start_date = input.startDate;
      if (input.completionDate !== undefined) patch.completion_date = input.completionDate;
      if (input.revisedCompletionDate !== undefined) {
        patch.revised_completion_date = input.revisedCompletionDate;
      }
      if (input.clientName !== undefined) patch.client_name = input.clientName;
      if (input.contractorEntity !== undefined) patch.contractor_entity = input.contractorEntity;
      if (input.projectType !== undefined) patch.project_type = input.projectType;
      if (input.workingDays !== undefined) {
        if (input.workingDays.length === 0) {
          throw new BadRequestError("A project needs at least one working day a week");
        }
        patch.working_days = JSON.stringify([...new Set(input.workingDays)].sort());
      }
      if (input.holidays !== undefined) patch.holidays = JSON.stringify(input.holidays);
      if (input.aiUpdateCadence !== undefined) patch.ai_update_cadence = input.aiUpdateCadence;

      if (Object.keys(patch).length > 0) await repository.update(id, patch);
      return this.getProfile(id);
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

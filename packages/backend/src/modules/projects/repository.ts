import type { Knex } from "knex";
import { isEmployeeRole } from "../../lib/permissions.ts";
import type { CurrencyCode } from "../../lib/currencies.ts";
import type {
  ProjectPhaseRow,
  ProjectRow,
  ProjectSetup,
} from "./types.ts";

export interface NewProjectRecord {
  id: string;
  owner_id: string | null;
  organization_id: string | null;
  name: string;
  address: string;
  status: "On Track";
  health_score: number;
  risk: "Low";
  progress_percent: number;
  budget_total: number;
  budget_used: number;
  currency: CurrencyCode;
  pending_approvals: number;
  folder_tone: "orange" | "brand" | "green" | "purple";
  budget_min: number;
  budget_max: number;
  setup: ProjectSetup;
}

export interface ProjectUpdatePatch {
  budget_total?: number;
  budget_min?: number;
  budget_max?: number;
  currency?: CurrencyCode;
}

export interface NewPhaseRecord {
  id: string;
  project_id: string;
  name: string;
  status: "Pending";
  date_range: string;
  sort_order: number;
}

export interface NewFinancesRecord {
  project_id: string;
  currency: CurrencyCode;
  total_budget: number;
  funds_deposited: number;
  funds_released: number;
  locked_in_escrow: number;
  remaining_balance: number;
}

/**
 * Template-seeded task board created alongside the project. Mirrors the shape
 * the tasks module's ensureDefaultBoard produces so it is picked up as the
 * project's default board.
 */
export interface TaskSeed {
  board: {
    id: string;
    project_id: string;
    name: string;
    is_default: boolean;
    created_by_id: string | null;
  };
  columns: Array<{
    id: string;
    board_id: string;
    name: string;
    status: string | null;
    position: number;
  }>;
  tasks: Array<{
    id: string;
    project_id: string;
    board_id: string;
    column_id: string;
    title: string;
    description: string | null;
    description_html: string | null;
    assignee_id: string | null;
    assignee_team_member_id: string | null;
    due_date: string | null;
    priority: string;
    labels: string;
    position: number;
    source_type: string | null;
    source_id: string | null;
    created_by_id: string | null;
  }>;
}

export function projectsRepository(db: Knex) {
  return {
    // Lists projects the user can see: ones they own, seed rows, projects in the
    // given orgs where they have org-wide access (owner/admin/member/viewer —
    // NOT employee), and projects they are an active participant on regardless
    // of org. Employees only see their participant projects.
    async listForUser(
      ownerId: string,
      orgRoles: ReadonlyMap<string, string>,
    ): Promise<ProjectRow[]> {
      const orgWideProjectOrgIds = [...orgRoles.entries()]
        .filter(([, role]) => !isEmployeeRole(role))
        .map(([orgId]) => orgId);
      const participantProjectIds = await db("project_participants")
        .where({ user_id: ownerId })
        .whereNot("status", "revoked")
        .pluck<string[]>("project_id");
      return db<ProjectRow>("projects")
        .where(function () {
          this.where("owner_id", ownerId)
            .orWhere(function () {
              this.whereNull("owner_id").whereNull("organization_id");
            });
          if (orgWideProjectOrgIds.length) this.orWhereIn("organization_id", orgWideProjectOrgIds);
          if (participantProjectIds.length) this.orWhereIn("id", participantProjectIds);
        })
        .orderBy("updated_at", "desc");
    },

    findById(id: string): Promise<ProjectRow | undefined> {
      return db<ProjectRow>("projects").where({ id }).first();
    },

    async update(id: string, patch: ProjectUpdatePatch): Promise<void> {
      await db("projects")
        .where({ id })
        .update({ ...patch, updated_at: db.fn.now() });
    },

    async delete(id: string): Promise<void> {
      await db("projects").where({ id }).delete();
    },

    async updateCurrency(id: string, currency: CurrencyCode): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("projects").where({ id }).update({ currency, updated_at: db.fn.now() });
        await trx("project_finances").where({ project_id: id }).update({ currency });
      });
    },

    findPhasesByProject(projectId: string): Promise<ProjectPhaseRow[]> {
      return db<ProjectPhaseRow>("project_phases")
        .where({ project_id: projectId })
        .orderBy("sort_order", "asc");
    },

    findPhasesByProjects(projectIds: string[]): Promise<ProjectPhaseRow[]> {
      if (projectIds.length === 0) return Promise.resolve([]);
      return db<ProjectPhaseRow>("project_phases")
        .whereIn("project_id", projectIds)
        .orderBy([
          { column: "project_id", order: "asc" },
          { column: "sort_order", order: "asc" },
        ]);
    },

    create(
      project: NewProjectRecord,
      phases: NewPhaseRecord[],
      finances: NewFinancesRecord,
      taskSeed?: TaskSeed,
    ): Promise<void> {
      return db.transaction(async (trx) => {
        await trx("projects").insert({
          ...project,
          setup: JSON.stringify(project.setup),
        });
        if (phases.length) await trx("project_phases").insert(phases);
        await trx("project_finances").insert(finances);
        if (taskSeed) {
          await trx("task_boards").insert(taskSeed.board);
          if (taskSeed.columns.length) await trx("task_columns").insert(taskSeed.columns);
          if (taskSeed.tasks.length) await trx("tasks").insert(taskSeed.tasks);
        }
      });
    },
  };
}

export type ProjectsRepository = ReturnType<typeof projectsRepository>;

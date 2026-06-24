import type { Knex } from "knex";
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

export function projectsRepository(db: Knex) {
  return {
    // Lists projects the user can see: ones they own, seed rows, projects in the
    // given orgs (the dashboard passes only the active org so switching company
    // changes the list; cross-org views pass all orgs), and projects they are an
    // active participant on regardless of org.
    async listForUser(ownerId: string, orgIds: string[]): Promise<ProjectRow[]> {
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
          if (orgIds.length) this.orWhereIn("organization_id", orgIds);
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
    ): Promise<void> {
      return db.transaction(async (trx) => {
        await trx("projects").insert({
          ...project,
          setup: JSON.stringify(project.setup),
        });
        if (phases.length) await trx("project_phases").insert(phases);
        await trx("project_finances").insert(finances);
      });
    },
  };
}

export type ProjectsRepository = ReturnType<typeof projectsRepository>;

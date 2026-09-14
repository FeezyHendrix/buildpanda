import type { Knex } from "knex";
import type {
  EmergencyContact,
  MethodStatementRow,
  MethodStep,
  PhasePlanRow,
  SafetyDocOrigin,
  SafetyDocStatus,
  SafetyScope,
} from "./types.ts";

export interface NewMethodStatementRecord {
  id: string;
  proposal_id: string | null;
  project_id: string | null;
  activity_name: string;
  programme_task_id: string | null;
  activity_id: string | null;
  hazards: string[];
  steps: MethodStep[];
  origin: SafetyDocOrigin;
  status: SafetyDocStatus;
  created_by: string | null;
}

export interface MethodStatementPatch {
  activity_name?: string;
  programme_task_id?: string | null;
  activity_id?: string | null;
  hazards?: string[];
  steps?: MethodStep[];
  status?: SafetyDocStatus;
  confirmed_by?: string | null;
  confirmed_at?: Date | null;
}

export interface NewPhasePlanRecord {
  id: string;
  proposal_id: string | null;
  project_id: string | null;
  key_dates_note: string | null;
  site_rules: string | null;
  welfare: string | null;
  first_aid: string | null;
  services_isolation: string | null;
  asbestos_note: string | null;
  hazards: string[];
  supervision: string | null;
  emergency_contacts: EmergencyContact[];
  origin: SafetyDocOrigin;
  status: SafetyDocStatus;
}

export type PhasePlanPatch = Partial<Omit<NewPhasePlanRecord, "id" | "proposal_id" | "project_id">> & {
  confirmed_by?: string | null;
  confirmed_at?: Date | null;
};

const scopeWhere = (scope: SafetyScope) =>
  scope.proposalId ? { proposal_id: scope.proposalId } : { project_id: scope.projectId };

// jsonb columns are written as strings so pg never tries to expand an array
// into a Postgres array literal.
const json = <T>(value: T) => JSON.stringify(value) as unknown as T;

export function methodStatementsRepository(db: Knex) {
  return {
    listByScope: (scope: SafetyScope) =>
      db<MethodStatementRow>("method_statements").where(scopeWhere(scope)).orderBy("created_at", "asc"),

    findById: (id: string) => db<MethodStatementRow>("method_statements").where({ id }).first(),

    async insert(record: NewMethodStatementRecord): Promise<MethodStatementRow> {
      const [row] = await db<MethodStatementRow>("method_statements")
        .insert({ ...record, hazards: json(record.hazards), steps: json(record.steps) })
        .returning("*");
      if (!row) throw new Error("Failed to insert method statement");
      return row;
    },

    async insertMany(records: NewMethodStatementRecord[]): Promise<MethodStatementRow[]> {
      if (records.length === 0) return [];
      return db<MethodStatementRow>("method_statements")
        .insert(records.map((r) => ({ ...r, hazards: json(r.hazards), steps: json(r.steps) })))
        .returning("*");
    },

    async update(id: string, patch: MethodStatementPatch): Promise<MethodStatementRow | undefined> {
      const dbPatch: Record<string, unknown> = { ...patch, updated_at: db.fn.now() };
      if (patch.hazards !== undefined) dbPatch["hazards"] = json(patch.hazards);
      if (patch.steps !== undefined) dbPatch["steps"] = json(patch.steps);
      const [row] = await db<MethodStatementRow>("method_statements").where({ id }).update(dbPatch).returning("*");
      return row;
    },

    remove: (id: string) => db("method_statements").where({ id }).delete(),

    // ---- construction phase plan (one per scope) ----
    phasePlanByScope: (scope: SafetyScope) =>
      db<PhasePlanRow>("construction_phase_plans").where(scopeWhere(scope)).first(),

    async insertPhasePlan(record: NewPhasePlanRecord): Promise<PhasePlanRow> {
      const [row] = await db<PhasePlanRow>("construction_phase_plans")
        .insert({ ...record, hazards: json(record.hazards), emergency_contacts: json(record.emergency_contacts) })
        .returning("*");
      if (!row) throw new Error("Failed to insert phase plan");
      return row;
    },

    async updatePhasePlan(id: string, patch: PhasePlanPatch): Promise<PhasePlanRow | undefined> {
      const dbPatch: Record<string, unknown> = { ...patch, updated_at: db.fn.now() };
      if (patch.hazards !== undefined) dbPatch["hazards"] = json(patch.hazards);
      if (patch.emergency_contacts !== undefined) dbPatch["emergency_contacts"] = json(patch.emergency_contacts);
      const [row] = await db<PhasePlanRow>("construction_phase_plans").where({ id }).update(dbPatch).returning("*");
      return row;
    },
  };
}

export type MethodStatementsRepository = ReturnType<typeof methodStatementsRepository>;

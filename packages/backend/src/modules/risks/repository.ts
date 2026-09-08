import type { Knex } from "knex";
import type { RiskFactorRow, RiskImpact, RiskLikelihood, RiskOrigin, RiskStatus } from "./types.ts";
import type { RiskLevel } from "../projects/types.ts";

export interface NewRiskFactorRecord {
  id: string;
  project_id: string | null;
  proposal_id: string | null;
  title: string;
  description: string;
  description_html: string | null;
  severity: RiskLevel;
  likelihood: RiskLikelihood | null;
  impact: RiskImpact | null;
  owner_id: string | null;
  owner_name: string | null;
  mitigation: string | null;
  status: RiskStatus;
  review_date: string | null;
  origin: RiskOrigin;
}

export interface RiskFactorUpdatePatch {
  title?: string;
  description?: string;
  description_html?: string | null;
  severity?: RiskLevel;
  likelihood?: RiskLikelihood | null;
  impact?: RiskImpact | null;
  owner_id?: string | null;
  owner_name?: string | null;
  mitigation?: string | null;
  status?: RiskStatus;
  review_date?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: Date | null;
  updated_at?: Knex.Raw | Date;
}

export function risksRepository(db: Knex) {
  return {
    listByProject(projectId: string): Promise<RiskFactorRow[]> {
      return db<RiskFactorRow>("risk_factors").where({ project_id: projectId }).orderBy("created_at", "desc");
    },

    listByProposal(proposalId: string): Promise<RiskFactorRow[]> {
      return db<RiskFactorRow>("risk_factors").where({ proposal_id: proposalId }).orderBy("created_at", "asc");
    },

    findById(id: string): Promise<RiskFactorRow | undefined> {
      return db<RiskFactorRow>("risk_factors").where({ id }).first();
    },

    async create(record: NewRiskFactorRecord): Promise<RiskFactorRow> {
      const [row] = await db<RiskFactorRow>("risk_factors").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert risk factor");
      return row;
    },

    async createMany(records: NewRiskFactorRecord[]): Promise<RiskFactorRow[]> {
      if (records.length === 0) return [];
      return db<RiskFactorRow>("risk_factors").insert(records).returning("*");
    },

    async update(id: string, patch: RiskFactorUpdatePatch): Promise<RiskFactorRow | undefined> {
      const [row] = await db<RiskFactorRow>("risk_factors")
        .where({ id })
        .update({ ...patch, updated_at: db.fn.now() })
        .returning("*");
      return row;
    },

    async deleteRiskFactor(id: string): Promise<void> {
      await db("risk_factors").where({ id }).delete();
    },
  };
}

export type RisksRepository = ReturnType<typeof risksRepository>;

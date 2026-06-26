import type { Knex } from "knex";
import type { PaymentClaimRow, PaymentClaimStatus } from "./types.ts";

export interface NewPaymentClaimRecord {
  id: string;
  project_id: string;
  milestone_payment_id: string | null;
  claim_number: string;
  period_start: string | null;
  period_end: string | null;
  amount: string;
  status: PaymentClaimStatus;
  submitted_at: string | null;
  approved_at: string | null;
  notes: string | null;
}

export interface PaymentClaimUpdatePatch {
  milestone_payment_id?: string | null;
  claim_number?: string;
  period_start?: string | null;
  period_end?: string | null;
  amount?: string;
  status?: PaymentClaimStatus;
  submitted_at?: string | null;
  approved_at?: string | null;
  notes?: string | null;
}

export function paymentClaimsRepository(db: Knex) {
  return {
    listByProject(projectId: string): Promise<PaymentClaimRow[]> {
      return db<PaymentClaimRow>("payment_claims")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc");
    },

    findById(id: string): Promise<PaymentClaimRow | undefined> {
      return db<PaymentClaimRow>("payment_claims").where({ id }).first();
    },

    async create(record: NewPaymentClaimRecord): Promise<PaymentClaimRow> {
      const [row] = await db<PaymentClaimRow>("payment_claims")
        .insert(record)
        .returning("*");
      if (!row) throw new Error("Failed to insert payment claim");
      return row;
    },

    async update(
      id: string,
      patch: PaymentClaimUpdatePatch,
    ): Promise<PaymentClaimRow | undefined> {
      const [row] = await db<PaymentClaimRow>("payment_claims")
        .where({ id })
        .update(patch)
        .returning("*");
      return row;
    },

    async deleteClaim(id: string): Promise<number> {
      return db("payment_claims").where({ id }).delete();
    },
  };
}

export type PaymentClaimsRepository = ReturnType<typeof paymentClaimsRepository>;

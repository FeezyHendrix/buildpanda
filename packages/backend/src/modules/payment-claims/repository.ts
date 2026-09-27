import type { Knex } from "knex";
import type { BillingContext } from "./deductions.ts";
import { OPEN_CLAIM_STATUSES, type PaymentClaimRow, type PaymentClaimStatus } from "./types.ts";

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
  retention_amount?: string | null;
  advance_recovery_amount?: string | null;
  vat_amount?: string | null;
  wht_amount?: string | null;
  invoice_amount?: string | null;
  invoice_number?: string | null;
  invoice_recorded_at?: string | null;
  invoice_recorded_by?: string | null;
}

const ADVANCE_NAME = /advance|mobili[sz]ation|deposit/i;

export function paymentClaimsRepository(db: Knex) {
  // Other workstreams add projects.estimate_id and estimates.wht_pct. Until
  // both land, withholding tax falls back to zero rather than failing the query.
  const columnCache = new Map<string, Promise<boolean>>();
  const hasColumn = (table: string, column: string): Promise<boolean> => {
    const key = `${table}.${column}`;
    let cached = columnCache.get(key);
    if (!cached) {
      cached = db.schema.hasColumn(table, column).catch(() => false);
      columnCache.set(key, cached);
    }
    return cached;
  };

  return {
    listByProject(projectId: string): Promise<PaymentClaimRow[]> {
      return db<PaymentClaimRow>("payment_claims")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc");
    },

    findById(id: string): Promise<PaymentClaimRow | undefined> {
      return db<PaymentClaimRow>("payment_claims").where({ id }).first();
    },

    openClaimForMilestone(milestoneId: string, excludeId?: string): Promise<PaymentClaimRow | undefined> {
      return db<PaymentClaimRow>("payment_claims")
        .where({ milestone_payment_id: milestoneId })
        .whereIn("status", [...OPEN_CLAIM_STATUSES])
        .modify((q) => {
          if (excludeId) q.whereNot({ id: excludeId });
        })
        .first();
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

    // Everything the deduction arithmetic needs, from the project's contract
    // terms, the organisation's tax default, the estimate's WHT choice (when
    // the column exists) and the advance milestone already on the project.
    async billingContext(projectId: string): Promise<BillingContext> {
      const finances = await db("project_finances")
        .where({ project_id: projectId })
        .select("retention_rate", "advance_percentage", "advance_recovery_rate", "advance_recovered", "contract_sum")
        .first();
      const project = await db("projects")
        .where({ id: projectId })
        .select("organization_id", ...(await hasColumn("projects", "estimate_id") ? ["estimate_id"] : []))
        .first();
      const org = project?.organization_id
        ? await db("organization").where({ id: project.organization_id }).select("default_tax_pct").first()
        : undefined;

      let whtPct = 0;
      if (project?.estimate_id && (await hasColumn("estimates", "wht_pct"))) {
        const estimate = await db("estimates").where({ id: project.estimate_id }).select("wht_pct").first();
        whtPct = Number(estimate?.wht_pct ?? 0);
      }

      const advanceMilestone = await db("milestone_payments")
        .where({ project_id: projectId })
        .select("name", "amount")
        .then((rows: { name: string; amount: string }[]) => rows.find((r) => ADVANCE_NAME.test(r.name)));
      const advanceFraction = Number(finances?.advance_percentage ?? 0);
      const contractSum = Number(finances?.contract_sum ?? 0);
      const advanceTotal = advanceMilestone ? Number(advanceMilestone.amount) : advanceFraction * contractSum;
      const recoveryRate = Number(finances?.advance_recovery_rate ?? 0);

      return {
        retentionRate: Number(finances?.retention_rate ?? 0),
        // recovery rate defaults to the advance percentage: a 20 % advance is
        // recovered at 20 % of each certificate until it is paid back
        advanceRate: recoveryRate > 0 ? recoveryRate : advanceFraction,
        advanceTotal,
        advanceRecovered: Number(finances?.advance_recovered ?? 0),
        vatPct: Number(org?.default_tax_pct ?? 7.5),
        whtPct,
      };
    },
  };
}

export type PaymentClaimsRepository = ReturnType<typeof paymentClaimsRepository>;

import type { Knex } from "knex";
import type { CertifiedTotalsRow, EotDaysRow, ProjectDatesRow } from "./types.ts";

/**
 * The queries behind the one money model. Certification and payment come from
 * RECEIVABLE invoices only — what the contractor certified to the employer —
 * and a voided certificate contributes nothing, which is what makes voiding a
 * safe alternative to deleting a paid record.
 *
 * The EOT and revised-completion reads are guarded: the extension-of-time
 * table and the project date columns are created by a parallel workstream, so
 * this module degrades to null rather than failing when they are absent.
 */
export function financeSummaryRepository(db: Knex) {
  async function hasTable(name: string): Promise<boolean> {
    const result = await db.raw("select to_regclass(?) as t", [name]);
    return Boolean(result.rows?.[0]?.t);
  }

  return {
    /**
     * Gross certified is the VALUE OF WORK certified (ex-VAT), so it compares
     * like for like with the contract sum; retention and advance recovery are
     * deductions from it, not part of it.
     */
    async certifiedTotals(projectId: string): Promise<CertifiedTotalsRow> {
      const row = await db("project_invoices")
        .where({ project_id: projectId, direction: "receivable" })
        .whereNull("voided_at")
        .whereIn("status", ["Approved", "Paid"])
        .select(
          db.raw("COALESCE(SUM(subtotal), 0)::text as certified"),
          db.raw("COALESCE(SUM(retention_amount), 0)::text as retention"),
          db.raw("COALESCE(SUM(advance_recovery), 0)::text as advance_recovered"),
          db.raw("COUNT(*)::text as certificates"),
        )
        .first<CertifiedTotalsRow>();
      return row ?? { certified: "0", retention: "0", advance_recovered: "0", certificates: "0" };
    },

    /** Money actually received against those certificates; a credit is not a receipt. */
    async paidTotal(projectId: string): Promise<string> {
      const row = await db("invoice_payments as p")
        .join("project_invoices as i", "i.id", "p.invoice_id")
        .where("i.project_id", projectId)
        .andWhere("i.direction", "receivable")
        .whereNull("i.voided_at")
        .andWhere("p.credit", false)
        .select(db.raw("COALESCE(SUM(p.amount), 0)::text as total"))
        .first<{ total: string }>();
      return row?.total ?? "0";
    },

    /** Contract completion vs the revised date an approved EOT moved it to. */
    async projectDates(projectId: string): Promise<ProjectDatesRow> {
      const [hasCompletion, hasRevised] = await Promise.all([
        db.schema.hasColumn("projects", "completion_date"),
        db.schema.hasColumn("projects", "revised_completion_date"),
      ]);
      if (!hasCompletion && !hasRevised) return { completion_date: null, revised_completion_date: null };
      const columns = [
        hasCompletion ? "completion_date" : db.raw("NULL as completion_date"),
        hasRevised ? "revised_completion_date" : db.raw("NULL as revised_completion_date"),
      ];
      const row = await db("projects").where({ id: projectId }).select(...columns).first<ProjectDatesRow>();
      return row ?? { completion_date: null, revised_completion_date: null };
    },

    /** Approved and still-pending extension-of-time days. Null while the module is absent. */
    async eotDays(projectId: string): Promise<EotDaysRow | null> {
      if (!(await hasTable("extension_of_time_claims"))) return null;
      const row = await db("extension_of_time_claims")
        .where({ project_id: projectId })
        .select(
          db.raw("COALESCE(SUM(CASE WHEN status = 'Approved' THEN days_awarded ELSE 0 END), 0)::text as approved"),
          db.raw("COALESCE(SUM(CASE WHEN status = 'Submitted' THEN days_claimed ELSE 0 END), 0)::text as pending"),
        )
        .first<EotDaysRow>();
      return row ?? { approved: "0", pending: "0" };
    },
  };
}

export type FinanceSummaryRepository = ReturnType<typeof financeSummaryRepository>;

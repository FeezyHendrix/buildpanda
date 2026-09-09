import type { Knex } from "knex";
import type { ComplianceDocRow } from "./types.ts";

export type ComplianceDocsRepository = ReturnType<typeof complianceDocsRepository>;

export function complianceDocsRepository(db: Knex) {
  return {
    listByOrg: (orgId: string) =>
      db<ComplianceDocRow>("precon_compliance_docs")
        .where({ org_id: orgId })
        .orderBy([{ column: "expiry_date", order: "asc" }, { column: "created_at", order: "desc" }]),
    byId: (id: string) => db<ComplianceDocRow>("precon_compliance_docs").where({ id }).first(),
    insert: async (row: Omit<ComplianceDocRow, "created_at" | "expiring_notified_at" | "expired_notified_at">) => {
      const [inserted] = await db<ComplianceDocRow>("precon_compliance_docs").insert(row).returning("*");
      return inserted!;
    },
    update: async (
      id: string,
      patch: Partial<Pick<ComplianceDocRow, "doc_type" | "reference" | "notes" | "expiry_date" | "expiring_notified_at" | "expired_notified_at">>,
    ) => {
      const [updated] = await db<ComplianceDocRow>("precon_compliance_docs").where({ id }).update(patch).returning("*");
      return updated;
    },
    delete: (id: string, orgId: string) =>
      db("precon_compliance_docs").where({ id, org_id: orgId }).delete(),

    // sweep queries: documents crossing the expiring window or the expiry date
    // that have not been notified yet
    expiringBetween: (fromDate: string, toDate: string) =>
      db<ComplianceDocRow>("precon_compliance_docs")
        .whereNotNull("expiry_date")
        .where("expiry_date", ">=", fromDate)
        .where("expiry_date", "<=", toDate)
        .whereNull("expiring_notified_at"),
    expiredBefore: (date: string) =>
      db<ComplianceDocRow>("precon_compliance_docs")
        .whereNotNull("expiry_date")
        .where("expiry_date", "<", date)
        .whereNull("expired_notified_at"),
    // owners and admins are who get told a certificate is lapsing
    orgAdminUserIds: async (orgId: string): Promise<string[]> => {
      const rows = await db("member")
        .where({ organizationId: orgId })
        .whereIn("role", ["owner", "admin"])
        .select<{ userId: string }[]>("userId");
      return rows.map((r) => r.userId);
    },
  };
}

import type { Knex } from "knex";
import { applyExpenseVisibility } from "../transactions/visibility-repository.ts";

export function messagingFinancialTargetRepository(db: Knex) {
  return {
    expenses(projectId: string, readerId: string | undefined) {
      return db("project_transactions").where({ project_id: projectId }).modify((query) => applyExpenseVisibility(query, readerId))
        .orderBy("created_at", "desc").limit(50).select("id as value", "title as label", "amount", "transacted_at as date", "vendor", "reference", "receipt_file_id as receiptFileId");
    },
    invoices(projectId: string, costs: boolean) {
      return db("project_invoices").where({ project_id: projectId }).modify((query) => { if (!costs) query.where("direction", "receivable"); })
        .orderBy("created_at", "desc").limit(50).select("id as value", "vendor_name as label", "number", "direction", "currency", "net_payable as amount", "status");
    },
    purchaseOrders(projectId: string) {
      return db("purchase_orders").where({ project_id: projectId }).orderBy("created_at", "desc").limit(50)
        .select("id as value", "po_number as label", "vendor_name as vendor", "status");
    },
  };
}

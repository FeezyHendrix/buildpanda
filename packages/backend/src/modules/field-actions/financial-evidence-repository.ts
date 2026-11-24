import { canProjectPermission } from "../../lib/authorization.ts";
import type { Knex } from "knex";
import { expenseReaderId } from "../transactions/access.ts";
import { applyExpenseVisibility } from "../transactions/visibility-repository.ts";
import type { FieldToolContext } from "./tool-types.ts";

export function financialEvidenceRepository(db: Knex) {
  // shortcut: legacy uploads have no fingerprint; backfill them if older evidence needs byte matching.
  const originals = (fileId: string) => db("uploaded_files").select("id").where("id", fileId)
    .orWhereIn("content_sha256", db("uploaded_files").select("content_sha256").where({ id: fileId }).whereNotNull("content_sha256"));
  return {
    async fingerprint(fileId: string) {
      return (await db("uploaded_files").where({ id: fileId }).first("content_sha256"))?.content_sha256 ?? fileId;
    },
    async lock(projectId: string, key: string) {
      if (db.isTransaction) await db.raw("select pg_advisory_xact_lock(hashtextextended(?, 0))", [`${projectId}:${key}`]);
    },
    async duplicateExpense(context: FieldToolContext, payload: Record<string, unknown>) {
      if (!payload.receiptFileId && !payload.reference) return false;
      return Boolean(await db("project_transactions").where({ project_id: context.project.id })
        .modify((query) => applyExpenseVisibility(query, expenseReaderId(context.request, context.project)))
        .where((query) => {
          if (payload.receiptFileId) query.orWhereIn("receipt_file_id", originals(payload.receiptFileId as string));
          if (payload.reference && payload.vendor) query.orWhere((reference) => reference.whereRaw("lower(trim(reference)) = lower(trim(?))", [String(payload.reference)])
            .whereRaw("lower(trim(vendor)) = lower(trim(?))", [String(payload.vendor)]).where("amount", payload.amount as number));
        }).first("id"));
    },
    async duplicateInvoice(projectId: string, payload: Record<string, unknown>) {
      return Boolean(await db("project_invoices").where({ project_id: projectId }).where((query) => {
        query.whereIn("source_file_id", originals(payload.sourceFileId as string));
        if (payload.number) query.orWhere((reference) => reference.whereRaw("lower(trim(number)) = lower(trim(?))", [String(payload.number)])
          .whereRaw("lower(trim(vendor_name)) = lower(trim(?))", [String(payload.vendorName)]));
      }).first("id"));
    },
    async invoicePaymentForEvidence(context: FieldToolContext, fileId: string) {
      const can = (action: string) => canProjectPermission({ id: context.project.id, ownerId: context.project.owner_id, organizationId: context.project.organization_id },
        { ...context.request, userId: context.user.id }, "finances", action);
      if (!can("view") && !can("viewCosts")) return false;
      return Boolean(await db("invoice_payments as payment").join("project_invoices as invoice", "invoice.id", "payment.invoice_id")
        .where("invoice.project_id", context.project.id).whereIn("payment.source_file_id", originals(fileId)).where((query) => {
          if (can("view")) query.orWhere("invoice.direction", "receivable");
          if (can("viewCosts")) query.orWhere("invoice.direction", "payable");
        }).first("payment.id"));
    },
    async paymentExists(invoiceId: string, fileId: string) {
      return Boolean(await db("invoice_payments").where({ invoice_id: invoiceId }).whereIn("source_file_id", originals(fileId)).first("id"));
    },
    async duplicatePurchaseOrder(projectId: string, fileId: string) {
      return Boolean(await db("purchase_orders").where({ project_id: projectId }).whereIn("source_file_id", originals(fileId)).first("id"));
    },
    async lockInvoice(projectId: string, invoiceId: string) {
      if (db.isTransaction) await db("project_invoices").where({ project_id: projectId, id: invoiceId }).forUpdate().first("id");
    },
    async lockPurchaseOrder(projectId: string, purchaseOrderId: string) {
      if (db.isTransaction) await db("purchase_orders").where({ project_id: projectId, id: purchaseOrderId }).forUpdate().first("id");
    },
    async lockExpense(projectId: string, expenseId: string) {
      if (db.isTransaction) await db("project_transactions").where({ project_id: projectId, id: expenseId }).forUpdate().first("id");
    },
  };
}

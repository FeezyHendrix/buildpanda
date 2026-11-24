import type { FieldToolKind } from "../field-actions/tool-types.ts";
import type { DocumentAnalysis } from "./document-analysis.ts";

// Destinations reference canonical actions, whose permission catalog controls availability.
const routes = {
  receipt: { label: "Expenses", actions: ["create_expense", "attach_expense_receipt", "record_invoice_payment", "upload_document"] },
  invoice: { label: "Invoices", actions: ["create_supplier_invoice", "upload_document"] },
  purchase_order: { label: "Purchase orders", actions: ["create_purchase_order", "upload_document"] },
  quote: { label: "Purchase order draft or Documents", actions: ["create_purchase_order", "upload_document"] },
  delivery_note: { label: "Materials received", actions: ["receive_material_order", "material_log", "receive_purchase_order"] },
  drawing: { label: "Documents / drawings", actions: ["upload_document", "upload_document_version"] },
  programme: { label: "Documents / programme", actions: ["upload_document"] },
  contract: { label: "Documents / contracts", actions: ["upload_document"] },
  safety: { label: "Documents / safety", actions: ["upload_document"] },
  report: { label: "Documents / reports", actions: ["upload_document", "daily_log"] },
  photo: { label: "Documents or project updates", actions: ["upload_document", "create_project_update"] },
  other: { label: "Documents", actions: ["upload_document"] },
} as const satisfies Record<DocumentAnalysis["kind"], { label: string; actions: readonly FieldToolKind[] }>;

export function documentDestinations(allowed: readonly { kind: FieldToolKind }[]) {
  const available = new Set<string>(allowed.map((tool) => tool.kind));
  return Object.fromEntries(Object.entries(routes).map(([kind, route]) => {
    const actions = route.actions.filter((action) => available.has(action));
    const documentsOnly = actions.length && actions.every((action) => ["upload_document", "upload_document_version"].includes(action));
    return [kind, { label: documentsOnly && kind !== "drawing" ? "Documents" : route.label, actions }];
  }));
}

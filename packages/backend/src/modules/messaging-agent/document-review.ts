import { referencedFileIds } from "@buildpanda/rich-content";
import type { Knex } from "knex";
import { BadRequestError } from "../../lib/errors.ts";
import type { FieldToolKind } from "../field-actions/tool-types.ts";
import type { MessagingSourceFile } from "./attachment-types.ts";
import type { DocumentInspection } from "./document-analysis.ts";
import { documentDestinations } from "./document-routing.ts";
import { messagingAttachmentRepository } from "./attachment-repository.ts";
import type { MessagingReviewAction } from "./management-types.ts";

export type InspectedSource = MessagingSourceFile & { inspection: DocumentInspection };
const imports = new Set(["create_expense", "create_purchase_order", "create_supplier_invoice", "receive_purchase_order", "record_invoice_payment", "material_log", "receive_material_order"]);

export function firstDocumentQuestion(files: InspectedSource[], tools: { kind: FieldToolKind }[]): string {
  if (files.length !== 1) return "Are these separate documents or pages of one document? Tell me what you want to do with each file.";
  const file = files[0]!, { analysis, notice } = file.inspection;
  if (!analysis) return `${notice ?? "I could not identify this file."} What is this document, and where do you want to save it?`;
  const route = documentDestinations(tools)[analysis.kind]!;
  const observed = [analysis.amount !== null ? `${analysis.currency ?? "Currency unclear"} ${analysis.amount}` : null, analysis.vendor ? `for ${analysis.vendor}` : null].filter(Boolean).join(" ");
  const identity = `${analysis.confidence === "low" ? "I am unsure of the document type. " : ""}This looks like ${analysis.kind.replace(/_/g, " ")} evidence${observed ? `: ${observed}` : ""}.`;
  if (!route.actions.length) return `${identity} Your current access does not allow its suggested destination. Ask your project administrator for access, or tell me another permitted use.`;
  if (analysis.kind === "receipt" && route.actions.some((kind) => kind !== "upload_document")) {
    const questions = [!analysis.purpose ? "What was this payment for?" : null, analysis.direction === "unknown" ? "Was it money you paid or received?" : null].filter(Boolean);
    return `${identity} ${questions.length ? questions.join(" ") : `How do you want to record this payment for ${analysis.purpose}?`}${notice ? ` ${notice}` : ""}`;
  }
  if (analysis.kind === "purchase_order" && route.actions.includes("create_purchase_order")) return `${identity} Is this an order to your supplier or an order from your client? I can prepare a supplier PO draft after you choose.${notice ? ` ${notice}` : ""}`;
  return `${identity}${analysis.revision ? ` Revision: ${analysis.revision}.` : ""} Save it in ${route.label}, or use it for something else?${notice ? ` ${notice}` : ""}`;
}

export function validateDocumentDraft(actions: MessagingReviewAction[], files: InspectedSource[]) {
  for (const action of actions) {
    if (!imports.has(action.kind)) continue;
    const id = action.payload.sourceFileId ?? action.payload.receiptFileId;
    if (action.kind === "create_expense" && files.length && !id) throw new BadRequestError("Choose the original receipt for this expense so its evidence stays attached.");
    const sources = typeof id === "string" ? files.filter((file) => file.id === id) : files;
    if (sources.some((file) => file.inspection.status === "read" && !file.inspection.complete)) throw new BadRequestError("This document was only partly read. Send the relevant pages or a shorter file before importing financial or delivery details. You can still save the original in Documents.");
  }
}

export async function requireCompleteDocumentEvidence(db: Knex, conversationId: string, actions: { kind: string; payload: Record<string, unknown> }[]) {
  for (const action of actions) {
    if (!imports.has(action.kind)) continue;
    for (const id of referencedFileIds(action.payload)) {
      const inspection = await messagingAttachmentRepository(db).inspection(conversationId, id);
      if (inspection?.status === "read" && !inspection.complete) throw new BadRequestError("This source was only partly read. Send the relevant pages or a shorter document before confirming the import.");
    }
  }
}

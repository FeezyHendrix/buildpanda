import { collaborationSchemas } from "./collaboration-schemas.ts";

const overrides = {
  send_message: { label: "Send message", description: collaborationSchemas.send_message.description },
  annotate_drawing: { label: "Annotate drawing", description: "Add a pin, pen stroke, cloud or measurement on the exact document revision and page. Use explicit supplied geometry; never guess coordinates. Optional comments preserve rich text and media. An authorized RFI or material-approval follow-up is created against the actual new annotation in the same confirmed request." },
  receive_material_order: { label: "Receive ordered materials", description: "Record deliveredQty and actual deliveredAt against an authorized named receivable order. Include unit from the user's explicit statement or the authorized order context when only a number was stated. The unit must match the current order; never reinterpret or convert a conflicting stated unit. Preserve delivery note, recipient, notes and rejected-load details." },
  create_expense: { label: "Record expense", description: "Record the supplied amount with its explicit currency. When the user states no currency, use the authorized project's currency context. The currency must match the current project; never reinterpret a conflicting currency or guess an exchange rate. Preserve category, date, vendor, receipt, stage, refund and recoverable-outlay details." },
  resolve_drawing: { label: "Resolve or reopen annotation", description: "Set resolved=true to resolve an authorized drawing annotation, or resolved=false to reopen it. Keep its original document revision; do not substitute a text status." },
  delete_material_order: { label: "Delete material order", description: "Permanently delete an existing material order only when deletion was explicitly requested. A cancellation uses update_material_order with patch.status=Cancelled and the user's reason, preserving the order and its audit history." },
  reopen_material_approval: { label: "Reopen or resubmit material approval", description: "A Resubmit request returns to Pending on the same record. Approved and Rejected decisions stay immutable; resubmission creates a linked replacement request. A Pending request is already awaiting review. Preserve the named reviewer and explicit requested amendments." },
};

export function descriptionOverride(kind: string) {
  return Object.hasOwn(overrides, kind) ? overrides[kind as keyof typeof overrides] : undefined;
}

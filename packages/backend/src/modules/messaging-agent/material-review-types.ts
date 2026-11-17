import type { LogEntryInput } from "../materials-ledger/service.ts";

export type MessagingMaterialPayload = Pick<LogEntryInput,
  "entryType" | "materialName" | "quantity" | "unit" | "reason" | "notesHtml" | "occurredAt" | "supplier" | "deliveryNote" | "locationKey"
>;

export interface MessagingMaterialCommand {
  kind: "material_log";
  projectId: string;
  payload: MessagingMaterialPayload;
}

import type { EnrichedAccessContext } from "../../lib/authorization.ts";
import type { AuthorizedProject } from "../../lib/authorization-request.ts";
import type { MaterialsLedgerService } from "../materials-ledger/service.ts";
import type { LogEntryInput } from "../materials-ledger/types.ts";
import type { FieldActionUser, FieldActor } from "./types.ts";

export interface MaterialLogCommand {
  kind: "material_log";
  projectId: string;
  payload: Pick<LogEntryInput, "entryType" | "materialName" | "unit" | "quantity" | "locationKey" | "occurredAt" | "reason" | "notesHtml" | "supplier" | "deliveryNote" | "idempotencyKey">;
}

export interface MaterialLogScope {
  project: AuthorizedProject;
  actor: FieldActionUser;
}

export interface MaterialLogAuthorizationDeps {
  userById(userId: string): Promise<FieldActionUser | undefined>;
  loadAccess(userId: string): Promise<EnrichedAccessContext>;
  projectById(projectId: string): Promise<AuthorizedProject | undefined>;
  isEnabled(): Promise<boolean>;
}

export interface MaterialLogExecutionDeps {
  authorize(actor: FieldActor, projectId: string, entryType: "IN" | "USED"): Promise<MaterialLogScope>;
  ledger: Pick<MaterialsLedgerService, "logEntry">;
}

export interface MaterialLogActionResult {
  kind: "material_log";
  projectId: string;
  recordId: string;
  entryType: "IN" | "USED";
  materialName: string;
  quantity: number;
  unit: string;
  onHandQty: number;
  duplicate: boolean;
}

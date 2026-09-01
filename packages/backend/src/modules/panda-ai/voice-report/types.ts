export interface RfiPayload {
  subject: string;
  question: string;
  priority?: "Low" | "Normal" | "High";
}

export interface DailyLogPayload {
  bodyText: string;
}

export interface ChangeRequestPayload {
  title: string;
  description?: string | null;
  reason?: string | null;
}

export interface MaterialOrderPayload {
  title: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplier?: string | null;
}

export interface MaterialLogPayload {
  entryType: "IN" | "USED";
  materialName: string;
  quantity: number;
  unit: string;
  locationKey?: string | null;
  reason?: string | null;
  notesHtml?: string | null;
}

export interface LookAheadPayload {
  name: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  totalWorkers?: number | null;
}

export interface RfiUpdatePayload {
  rfiId: string;
  patch: {
    subject?: string;
    question?: string;
    priority?: "Low" | "Normal" | "High";
    dueDate?: string | null;
  };
}

export interface RfiTransitionPayload {
  rfiId: string;
  status: "Closed" | "Void" | "Open";
}

export interface ChangeRequestUpdatePayload {
  changeRequestId: string;
  patch: {
    title?: string;
    description?: string | null;
    reason?: string | null;
    costImpact?: number;
    timeImpactDays?: number;
  };
}

export interface ChangeRequestDeletePayload {
  changeRequestId: string;
}

export interface MaterialOrderUpdatePayload {
  orderId: string;
  patch: {
    title?: string;
    materialName?: string;
    quantity?: number;
    unit?: string;
    supplier?: string | null;
  };
}

export interface MaterialOrderDeletePayload {
  orderId: string;
}

export interface LookAheadUpdatePayload {
  lookAheadId: string;
  patch: {
    name?: string;
    description?: string | null;
    startDate?: string;
    endDate?: string;
    totalWorkers?: number | null;
  };
}

export interface LookAheadDeletePayload {
  lookAheadId: string;
}

export interface DailyLogUpdatePayload {
  totalHours: number;
}

export interface ActivityLogPayload {
  activityId: string;
  /** Enriched server-side from the snapshot — the model never supplies it. */
  activityName: string;
  hoursLogged: number;
  delayReasonCode?: string | null;
  delayNote?: string | null;
}

export interface RfiCommentPayload {
  rfiId: string;
  body: string;
}

export interface ChangeRequestCommentPayload {
  changeRequestId: string;
  body: string;
}

export interface LedgerVoidPayload {
  entryId: string;
  reason: string;
}

export interface DailyLogEntryVoidPayload {
  entryId: string;
  /** Enriched server-side from the snapshot — the model never supplies it. */
  logDate: string;
  reason: string;
}

export interface StageTransitionPayload {
  stageId: string | null;
  status: "Pending" | "InProgress" | "Done" | null;
}

export type MissingFieldType = "text" | "number" | "date" | "select";

export interface MissingFieldOption {
  value: string;
  label: string;
}

// Server-computed, not model-authored: a required field the speaker never said,
// which the reviewer fills in rather than the action being silently dropped.
export interface MissingField {
  name: string;
  label: string;
  type: MissingFieldType;
  options?: MissingFieldOption[];
}

export type DraftAction =
  | { kind: "rfi"; title: string; summary: string; payload: RfiPayload }
  | { kind: "daily_log"; title: string; summary: string; payload: DailyLogPayload }
  | { kind: "change_request"; title: string; summary: string; payload: ChangeRequestPayload }
  | { kind: "material_log"; title: string; summary: string; payload: MaterialLogPayload }
  | { kind: "material_order"; title: string; summary: string; payload: MaterialOrderPayload }
  | { kind: "look_ahead"; title: string; summary: string; payload: LookAheadPayload }
  | { kind: "update_rfi"; title: string; summary: string; payload: RfiUpdatePayload }
  | { kind: "transition_rfi"; title: string; summary: string; payload: RfiTransitionPayload }
  | { kind: "update_change_request"; title: string; summary: string; payload: ChangeRequestUpdatePayload }
  | { kind: "delete_change_request"; title: string; summary: string; payload: ChangeRequestDeletePayload }
  | { kind: "update_material_order"; title: string; summary: string; payload: MaterialOrderUpdatePayload }
  | { kind: "delete_material_order"; title: string; summary: string; payload: MaterialOrderDeletePayload }
  | { kind: "update_look_ahead"; title: string; summary: string; payload: LookAheadUpdatePayload }
  | { kind: "delete_look_ahead"; title: string; summary: string; payload: LookAheadDeletePayload }
  | { kind: "update_daily_log"; title: string; summary: string; payload: DailyLogUpdatePayload }
  | { kind: "log_activity"; title: string; summary: string; payload: ActivityLogPayload }
  | { kind: "comment_rfi"; title: string; summary: string; payload: RfiCommentPayload }
  | { kind: "comment_change_request"; title: string; summary: string; payload: ChangeRequestCommentPayload }
  | { kind: "void_ledger_entry"; title: string; summary: string; payload: LedgerVoidPayload }
  | { kind: "void_daily_log_entry"; title: string; summary: string; payload: DailyLogEntryVoidPayload }
  | { kind: "transition_stage"; title: string; summary: string; payload: StageTransitionPayload };

export type ProposedAction = DraftAction & { missing: MissingField[] };

export interface SnapshotRfi {
  id: string;
  number: number;
  subject: string;
  status: string;
}

export interface SnapshotChangeRequest {
  id: string;
  title: string;
  status: string;
}

export interface SnapshotMaterialOrder {
  id: string;
  title: string;
  materialName: string;
  quantity: number;
  unit: string;
  status: string;
}

export interface SnapshotLookAhead {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

export interface SnapshotActivity {
  id: string;
  name: string;
  status: string;
}

export interface SnapshotDelayReason {
  code: string;
  name: string;
}

export interface SnapshotLedgerEntry {
  id: string;
  entryType: string;
  materialName: string;
  quantity: number;
  unit: string;
}

export interface SnapshotDailyLogEntry {
  id: string;
  logDate: string;
  authorName: string;
  snippet: string;
}

export interface SnapshotStage {
  id: string;
  name: string;
  status: string;
  buildingId: string;
}

export interface SnapshotBuilding {
  id: string;
  name: string;
  code: string | null;
}

export interface ProjectSnapshot {
  rfis: SnapshotRfi[];
  changeRequests: SnapshotChangeRequest[];
  materialOrders: SnapshotMaterialOrder[];
  lookAheads: SnapshotLookAhead[];
  activities: SnapshotActivity[];
  delayReasons: SnapshotDelayReason[];
  ledgerEntries: SnapshotLedgerEntry[];
  todayEntries: SnapshotDailyLogEntry[];
  stages: SnapshotStage[];
  buildings: SnapshotBuilding[];
  today: string;
}

export interface VoiceReport {
  transcript: string;
  actions: ProposedAction[];
}

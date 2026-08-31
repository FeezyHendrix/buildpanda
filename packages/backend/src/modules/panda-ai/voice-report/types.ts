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

export type ProposedAction =
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
  | { kind: "update_daily_log"; title: string; summary: string; payload: DailyLogUpdatePayload };

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

export interface ProjectSnapshot {
  rfis: SnapshotRfi[];
  changeRequests: SnapshotChangeRequest[];
  materialOrders: SnapshotMaterialOrder[];
  lookAheads: SnapshotLookAhead[];
}

export interface VoiceReport {
  transcript: string;
  actions: ProposedAction[];
}

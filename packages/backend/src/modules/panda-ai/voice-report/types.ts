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

export type ProposedAction =
  | { kind: "rfi"; title: string; summary: string; payload: RfiPayload }
  | { kind: "daily_log"; title: string; summary: string; payload: DailyLogPayload }
  | { kind: "change_request"; title: string; summary: string; payload: ChangeRequestPayload }
  | { kind: "material_log"; title: string; summary: string; payload: MaterialLogPayload }
  | { kind: "material_order"; title: string; summary: string; payload: MaterialOrderPayload }
  | { kind: "look_ahead"; title: string; summary: string; payload: LookAheadPayload };

export interface VoiceReport {
  transcript: string;
  actions: ProposedAction[];
}

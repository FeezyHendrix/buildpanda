import type { UpsertChangeRequestInput } from "./change-requests";
import type { CreateLookAheadInput } from "./look-aheads";
import type { LogMaterialEntryInput } from "./materials-ledger";
import type { CreateMaterialOrderInput } from "./materials";
import type { UpsertRfiInput } from "./rfis";

export type ProposedAction =
  | { kind: "rfi"; title: string; summary: string; payload: UpsertRfiInput }
  | { kind: "daily_log"; title: string; summary: string; payload: { bodyText: string } }
  | { kind: "change_request"; title: string; summary: string; payload: UpsertChangeRequestInput }
  | { kind: "material_log"; title: string; summary: string; payload: LogMaterialEntryInput }
  | { kind: "material_order"; title: string; summary: string; payload: CreateMaterialOrderInput }
  | { kind: "look_ahead"; title: string; summary: string; payload: CreateLookAheadInput };

export type ProposedActionKind = ProposedAction["kind"];

export interface VoiceReport {
  readonly transcript: string;
  readonly actions: ProposedAction[];
}

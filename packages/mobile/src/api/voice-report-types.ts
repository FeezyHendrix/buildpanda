import type { UpsertChangeRequestInput } from "./change-requests";
import type { CreateLookAheadInput } from "./look-aheads";
import type { LogMaterialEntryInput } from "./materials-ledger";
import type { CreateMaterialOrderInput } from "./materials";
import type { RfiStatusTransition, UpsertRfiInput } from "./rfis";

export type ProposedAction =
  | { kind: "rfi"; title: string; summary: string; payload: UpsertRfiInput }
  | { kind: "daily_log"; title: string; summary: string; payload: { bodyText: string } }
  | { kind: "change_request"; title: string; summary: string; payload: UpsertChangeRequestInput }
  | { kind: "material_log"; title: string; summary: string; payload: LogMaterialEntryInput }
  | { kind: "material_order"; title: string; summary: string; payload: CreateMaterialOrderInput }
  | { kind: "look_ahead"; title: string; summary: string; payload: CreateLookAheadInput }
  | { kind: "update_rfi"; title: string; summary: string; payload: { rfiId: string; patch: Partial<UpsertRfiInput> } }
  | { kind: "transition_rfi"; title: string; summary: string; payload: { rfiId: string; status: RfiStatusTransition } }
  | {
      kind: "update_change_request";
      title: string;
      summary: string;
      payload: { changeRequestId: string; patch: Partial<UpsertChangeRequestInput> };
    }
  | { kind: "delete_change_request"; title: string; summary: string; payload: { changeRequestId: string } }
  | {
      kind: "update_material_order";
      title: string;
      summary: string;
      payload: { orderId: string; patch: Partial<CreateMaterialOrderInput> };
    }
  | { kind: "delete_material_order"; title: string; summary: string; payload: { orderId: string } }
  | {
      kind: "update_look_ahead";
      title: string;
      summary: string;
      payload: { lookAheadId: string; patch: Partial<CreateLookAheadInput> };
    }
  | { kind: "delete_look_ahead"; title: string; summary: string; payload: { lookAheadId: string } }
  | { kind: "update_daily_log"; title: string; summary: string; payload: { totalHours: number } }
  | {
      kind: "log_activity";
      title: string;
      summary: string;
      payload: {
        activityId: string;
        activityName: string;
        hoursLogged: number;
        delayReasonCode?: string | null;
        delayNote?: string | null;
      };
    }
  | { kind: "comment_rfi"; title: string; summary: string; payload: { rfiId: string; body: string } }
  | {
      kind: "comment_change_request";
      title: string;
      summary: string;
      payload: { changeRequestId: string; body: string };
    }
  | { kind: "void_ledger_entry"; title: string; summary: string; payload: { entryId: string; reason: string } }
  | {
      kind: "void_daily_log_entry";
      title: string;
      summary: string;
      payload: { entryId: string; logDate: string; reason: string };
    };

export type ProposedActionKind = ProposedAction["kind"];

export interface VoiceReport {
  readonly transcript: string;
  readonly actions: ProposedAction[];
}

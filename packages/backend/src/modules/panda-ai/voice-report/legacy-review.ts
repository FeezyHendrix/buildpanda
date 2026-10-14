import { legacyReviewFields, fieldComplete, readVoicePath, spokenRichText } from "@buildpanda/voice-actions";
import { formReviewFields, normalizeDailyLogForm } from "./daily-log-form.ts";
import type { ParsedAction } from "./action-schemas.ts";
import type { LegacyDraftAction, ProjectSnapshot, MissingField, MissingFieldOption } from "./types.ts";
const STAGE_STATUSES = ["Pending", "InProgress", "Done"] as const;
const STAGE_STATUS_LABEL = { Pending: "Not started", InProgress: "Started", Done: "Completed" };
// Update/delete/log actions must reference a record from the snapshot; a target
// the model invented is cleared for review here. Fields the model must not author
// (activityName, logDate) are injected from the snapshot at the same time.
export function normalizeAction(action: ParsedAction, snapshot: ProjectSnapshot): LegacyDraftAction | null {
  switch (action.kind) {
    case "update_rfi":
    case "transition_rfi":
    case "comment_rfi":
      return snapshot.rfis.some((r) => r.id === action.payload.rfiId) ? action : { ...action, payload: { ...action.payload, rfiId: "" } };
    case "update_change_request":
    case "delete_change_request":
    case "comment_change_request":
      return snapshot.changeRequests.some((c) => c.id === action.payload.changeRequestId) ? action : { ...action, payload: { ...action.payload, changeRequestId: "" } };
    case "update_material_order":
    case "delete_material_order":
      return snapshot.materialOrders.some((m) => m.id === action.payload.orderId) ? action : { ...action, payload: { ...action.payload, orderId: "" } };
    case "update_look_ahead":
    case "delete_look_ahead":
      return snapshot.lookAheads.some((l) => l.id === action.payload.lookAheadId) ? action : { ...action, payload: { ...action.payload, lookAheadId: "" } };
    case "void_ledger_entry":
      return snapshot.ledgerEntries.some((e) => e.id === action.payload.entryId) ? action : { ...action, payload: { ...action.payload, entryId: "" } };
    case "void_daily_log_entry": {
      const entry = snapshot.todayEntries.find((e) => e.id === action.payload.entryId);
      if (!entry) return { ...action, payload: { ...action.payload, entryId: "", logDate: snapshot.today } };
      return { ...action, payload: { ...action.payload, logDate: entry.logDate } };
    }
    case "log_activity": {
      const activity = snapshot.activities.find((a) => a.id === action.payload.activityId);

      const codeValid = snapshot.delayReasons.some((d) => d.code === action.payload.delayReasonCode);
      return {
        ...action,
        payload: {
          activityId: activity?.id ?? "",
          activityName: activity?.name ?? "",
          hoursLogged: action.payload.hoursLogged,
          delayReasonCode: codeValid ? action.payload.delayReasonCode : null,
          delayNote: codeValid ? action.payload.delayNote : null,
        },
      };
    }
    case "transition_stage": {
      // An invented stage id is cleared rather than dropping the action, so the
      // reviewer is offered the stage picker instead of losing the request.
      const known = snapshot.stages.some((s) => s.id === action.payload.stageId);
      return known ? action : { ...action, payload: { ...action.payload, stageId: null } };
    }
    case "daily_log": {
      const payload = normalizeDailyLogForm(action.payload, snapshot);
      // a free-form note needs words; a filled form needs at least one answer
      const hasForm = Object.keys(payload.responses ?? {}).length > 0;

      return { ...action, payload: payload.templateId || hasForm ? payload : { buildingId: payload.buildingId, bodyText: payload.bodyText } };
    }
    default:
      return action;
  }
}

const BUILDING_SCOPED_KINDS = new Set(["daily_log", "update_daily_log", "look_ahead", "transition_stage"]);

function optionsFor(name: string, action: LegacyDraftAction, snapshot: ProjectSnapshot, source?: string): MissingFieldOption[] {
  if (source === "rfis") return snapshot.rfis.map((r) => ({ value: r.id, label: `RFI-${r.number}: ${r.subject}` }));
  if (source === "changeRequests") return snapshot.changeRequests.map((r) => ({ value: r.id, label: r.title }));
  if (source === "materialOrders") return snapshot.materialOrders.map((r) => ({ value: r.id, label: r.title }));
  if (source === "lookAheads") return snapshot.lookAheads.map((r) => ({ value: r.id, label: r.name }));
  if (source === "activities") return snapshot.activities.map((r) => ({ value: r.id, label: r.name }));
  if (source === "ledgerEntries") return snapshot.ledgerEntries.map((r) => ({ value: r.id, label: `${r.entryType}: ${r.quantity} ${r.unit} ${r.materialName}` }));
  if (source === "todayEntries") return snapshot.todayEntries.map((r) => ({ value: r.id, label: `${r.authorName}: ${r.snippet}` }));
  if (name === "buildingId") {
    return snapshot.buildings.map((b) => ({ value: b.id, label: b.code ? `${b.name} (${b.code})` : b.name }));
  }
  if (name === "status") {
    return STAGE_STATUSES.map((s) => ({ value: s, label: STAGE_STATUS_LABEL[s] }));
  }
  // Stage options narrow to the chosen building so a picker can never offer a
  // stage from a different block.
  const chosen = (action.payload as { buildingId?: string | null }).buildingId ?? null;
  return snapshot.stages
    .filter((s) => !chosen || s.buildingId === chosen)
    .map((s) => ({ value: s.id, label: `${s.name} — ${s.status}` }));
}

/**
 * Required fields the speaker never supplied, which the review screen collects
 * before the action may be applied. buildingId is added only when the project
 * has more than one building, because that is the case the API refuses.
 */
export function collectReviewFields(action: LegacyDraftAction, snapshot: ProjectSnapshot): MissingField[] {
  const fields: MissingField[] = legacyReviewFields(action);
  if (action.kind === "transition_stage") fields.push(
    { name: "stageId", label: "Stage", type: "select", required: true },
    { name: "status", label: "New status", type: "select", required: true },
  );
  if (action.kind === "daily_log") fields.push(...formReviewFields(action.payload, snapshot));
  if (BUILDING_SCOPED_KINDS.has(action.kind) && snapshot.buildings.length > 1) {
    fields.unshift({ name: "buildingId", label: "Building", type: "select", required: true });
  }
  return fields.map((field) => field.type === "select" ? {
    ...field, options: field.options ?? field.choices?.map((value) => ({ value, label: value })) ?? optionsFor(field.name, action, snapshot, field.source),
  } : field);
}

export function computeMissing(action: LegacyDraftAction, snapshot: ProjectSnapshot): MissingField[] {
  return collectReviewFields(action, snapshot).filter((field) => {
    const raw = readVoicePath(action.payload, field.name);
    const value = field.type === "rich_text" && typeof raw === "string" ? spokenRichText(raw) : raw;
    return !fieldComplete({ ...field, required: field.required ?? true, choices: field.options?.map((option) => option.value) }, value);
  });
}

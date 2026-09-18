import { CLASSIFY_SYSTEM, snapshotPrompt } from "./prompt.ts";
import { z } from "zod";
import { BadRequestError } from "../../../lib/errors.ts";
import { chatJson } from "../../../lib/llm.ts";
import { logger } from "../../../lib/logger.ts";
import { translateAudioToEnglish } from "../../../lib/speech.ts";
import type {
  DraftAction,
  MissingField,
  MissingFieldOption,
  ProjectSnapshot,
  ProposedAction,
  VoiceReport,
} from "./types.ts";

const priority = z.enum(["Low", "Normal", "High"]);

const rfiPayload = z.object({
  subject: z.string().min(1),
  question: z.string().min(1),
  priority: priority.optional(),
});

const dailyLogPayload = z.object({ bodyText: z.string().min(1), buildingId: z.string().min(1).nullish() });

const changeRequestPayload = z.object({
  title: z.string().min(1),
  description: z.string().nullish(),
  reason: z.string().nullish(),
});

const materialOrderPayload = z.object({
  title: z.string().min(1),
  materialName: z.string().min(1),
  quantity: z.number(),
  unit: z.string().min(1),
  supplier: z.string().nullish(),
  // The orders API requires this; when unsaid the reviewer is asked for it.
  neededBy: z.string().nullish(),
});

const materialLogPayload = z.object({
  entryType: z.enum(["IN", "USED"]),
  materialName: z.string().min(1),
  quantity: z.number(),
  unit: z.string().min(1),
  locationKey: z.string().nullish(),
  reason: z.string().nullish(),
  notesHtml: z.string().nullish(),
});

// startDate/endDate/buildingId are nullable so an action the speaker described
// but under-specified still reaches the reviewer, who fills the gap in the app.
const lookAheadPayload = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
  startDate: z.string().min(1).nullish(),
  endDate: z.string().min(1).nullish(),
  totalWorkers: z.number().nullish(),
  buildingId: z.string().min(1).nullish(),
});

const stageTransitionPayload = z.object({
  stageId: z.string().min(1).nullish().transform((id) => id ?? null),
  status: z.enum(["Pending", "InProgress", "Done"]).nullish().transform((status) => status ?? null),
  buildingId: z.string().min(1).nullish(),
});

const rfiUpdatePayload = z.object({
  rfiId: z.string().min(1),
  patch: z
    .object({
      subject: z.string().min(1).optional(),
      question: z.string().min(1).optional(),
      priority: priority.optional(),
      dueDate: z.string().nullish(),
    })
    .refine((p) => Object.keys(p).length > 0, "empty patch"),
});

const rfiTransitionPayload = z.object({
  rfiId: z.string().min(1),
  status: z.enum(["Closed", "Void", "Open"]),
});

const changeRequestUpdatePayload = z.object({
  changeRequestId: z.string().min(1),
  patch: z
    .object({
      title: z.string().min(1).optional(),
      description: z.string().nullish(),
      reason: z.string().nullish(),
      costImpact: z.number().optional(),
      timeImpactDays: z.number().optional(),
    })
    .refine((p) => Object.keys(p).length > 0, "empty patch"),
});

const changeRequestDeletePayload = z.object({ changeRequestId: z.string().min(1) });

const materialOrderUpdatePayload = z.object({
  orderId: z.string().min(1),
  patch: z
    .object({
      title: z.string().min(1).optional(),
      materialName: z.string().min(1).optional(),
      quantity: z.number().optional(),
      unit: z.string().min(1).optional(),
      supplier: z.string().nullish(),
    })
    .refine((p) => Object.keys(p).length > 0, "empty patch"),
});

const materialOrderDeletePayload = z.object({ orderId: z.string().min(1) });

const lookAheadUpdatePayload = z.object({
  lookAheadId: z.string().min(1),
  patch: z
    .object({
      name: z.string().min(1).optional(),
      description: z.string().nullish(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      totalWorkers: z.number().nullish(),
    })
    .refine((p) => Object.keys(p).length > 0, "empty patch"),
});

const lookAheadDeletePayload = z.object({ lookAheadId: z.string().min(1) });

const dailyLogUpdatePayload = z.object({ totalHours: z.number().min(0), buildingId: z.string().min(1).nullish() });

const activityLogPayload = z.object({
  activityId: z.string().min(1),
  hoursLogged: z.number().min(0),
  delayReasonCode: z.string().nullish(),
  delayNote: z.string().nullish(),
});

const rfiCommentPayload = z.object({ rfiId: z.string().min(1), body: z.string().min(1) });

const changeRequestCommentPayload = z.object({
  changeRequestId: z.string().min(1),
  body: z.string().min(1),
});

const ledgerVoidPayload = z.object({ entryId: z.string().min(1), reason: z.string().min(1) });

const dailyLogEntryVoidPayload = z.object({ entryId: z.string().min(1), reason: z.string().min(1) });

const STAGE_STATUSES = ["Pending", "InProgress", "Done"] as const;
const STAGE_STATUS_LABEL: Record<(typeof STAGE_STATUSES)[number], string> = {
  Pending: "Not started",
  InProgress: "Started",
  Done: "Completed",
};

const base = { title: z.string().min(1), summary: z.string() };

const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rfi"), ...base, payload: rfiPayload }),
  z.object({ kind: z.literal("daily_log"), ...base, payload: dailyLogPayload }),
  z.object({ kind: z.literal("change_request"), ...base, payload: changeRequestPayload }),
  z.object({ kind: z.literal("material_log"), ...base, payload: materialLogPayload }),
  z.object({ kind: z.literal("material_order"), ...base, payload: materialOrderPayload }),
  z.object({ kind: z.literal("look_ahead"), ...base, payload: lookAheadPayload }),
  z.object({ kind: z.literal("update_rfi"), ...base, payload: rfiUpdatePayload }),
  z.object({ kind: z.literal("transition_rfi"), ...base, payload: rfiTransitionPayload }),
  z.object({ kind: z.literal("update_change_request"), ...base, payload: changeRequestUpdatePayload }),
  z.object({ kind: z.literal("delete_change_request"), ...base, payload: changeRequestDeletePayload }),
  z.object({ kind: z.literal("update_material_order"), ...base, payload: materialOrderUpdatePayload }),
  z.object({ kind: z.literal("delete_material_order"), ...base, payload: materialOrderDeletePayload }),
  z.object({ kind: z.literal("update_look_ahead"), ...base, payload: lookAheadUpdatePayload }),
  z.object({ kind: z.literal("delete_look_ahead"), ...base, payload: lookAheadDeletePayload }),
  z.object({ kind: z.literal("update_daily_log"), ...base, payload: dailyLogUpdatePayload }),
  z.object({ kind: z.literal("log_activity"), ...base, payload: activityLogPayload }),
  z.object({ kind: z.literal("comment_rfi"), ...base, payload: rfiCommentPayload }),
  z.object({ kind: z.literal("comment_change_request"), ...base, payload: changeRequestCommentPayload }),
  z.object({ kind: z.literal("void_ledger_entry"), ...base, payload: ledgerVoidPayload }),
  z.object({ kind: z.literal("void_daily_log_entry"), ...base, payload: dailyLogEntryVoidPayload }),
  z.object({ kind: z.literal("transition_stage"), ...base, payload: stageTransitionPayload }),
]);

const envelopeSchema = z.object({ actions: z.array(z.unknown()) });

type ParsedAction = z.infer<typeof actionSchema>;

const EMPTY_SNAPSHOT: ProjectSnapshot = {
  rfis: [],
  changeRequests: [],
  materialOrders: [],
  lookAheads: [],
  activities: [],
  delayReasons: [],
  ledgerEntries: [],
  todayEntries: [],
  stages: [],
  buildings: [],
  today: new Date().toISOString().slice(0, 10),
};

// Update/delete/log actions must reference a record from the snapshot; a target
// the model invented is dropped here. Fields the model must not author
// (activityName, logDate) are injected from the snapshot at the same time.
function normalizeAction(action: ParsedAction, snapshot: ProjectSnapshot): DraftAction | null {
  switch (action.kind) {
    case "update_rfi":
    case "transition_rfi":
    case "comment_rfi":
      return snapshot.rfis.some((r) => r.id === action.payload.rfiId) ? action : null;
    case "update_change_request":
    case "delete_change_request":
    case "comment_change_request":
      return snapshot.changeRequests.some((c) => c.id === action.payload.changeRequestId) ? action : null;
    case "update_material_order":
    case "delete_material_order":
      return snapshot.materialOrders.some((m) => m.id === action.payload.orderId) ? action : null;
    case "update_look_ahead":
    case "delete_look_ahead":
      return snapshot.lookAheads.some((l) => l.id === action.payload.lookAheadId) ? action : null;
    case "void_ledger_entry":
      return snapshot.ledgerEntries.some((e) => e.id === action.payload.entryId) ? action : null;
    case "void_daily_log_entry": {
      const entry = snapshot.todayEntries.find((e) => e.id === action.payload.entryId);
      if (!entry) return null;
      return { ...action, payload: { ...action.payload, logDate: entry.logDate } };
    }
    case "log_activity": {
      const activity = snapshot.activities.find((a) => a.id === action.payload.activityId);
      if (!activity) return null;
      const codeValid = snapshot.delayReasons.some((d) => d.code === action.payload.delayReasonCode);
      return {
        ...action,
        payload: {
          activityId: activity.id,
          activityName: activity.name,
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
    default:
      return action;
  }
}

const BUILDING_SCOPED_KINDS = new Set(["daily_log", "update_daily_log", "look_ahead", "transition_stage"]);

function requiredFields(action: DraftAction): MissingField[] {
  switch (action.kind) {
    case "look_ahead":
      return [
        { name: "name", label: "Name", type: "text" },
        { name: "startDate", label: "Start date", type: "date" },
        { name: "endDate", label: "End date", type: "date" },
      ];
    case "transition_stage":
      return [
        { name: "stageId", label: "Stage", type: "select" },
        { name: "status", label: "New status", type: "select" },
      ];
    case "material_log":
      return [
        { name: "materialName", label: "Material", type: "text" },
        { name: "quantity", label: "Quantity", type: "number" },
        { name: "unit", label: "Unit", type: "text" },
      ];
    case "material_order":
      return [
        { name: "materialName", label: "Material", type: "text" },
        { name: "quantity", label: "Quantity", type: "number" },
        { name: "unit", label: "Unit", type: "text" },
        { name: "neededBy", label: "Needed by", type: "date" },
      ];
    default:
      return [];
  }
}

function optionsFor(name: string, action: DraftAction, snapshot: ProjectSnapshot): MissingFieldOption[] {
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
function computeMissing(action: DraftAction, snapshot: ProjectSnapshot): MissingField[] {
  const payload: Record<string, unknown> = { ...action.payload };
  const missing = requiredFields(action).filter((field) => {
    const value = payload[field.name];
    return value === null || value === undefined || value === "";
  });

  if (BUILDING_SCOPED_KINDS.has(action.kind) && snapshot.buildings.length > 1 && !snapshot.buildings.some((building) => building.id === payload["buildingId"])) {
    missing.unshift({ name: "buildingId", label: "Building", type: "select" });
  }

  return missing.map((field) =>
    field.type === "select" ? { ...field, options: optionsFor(field.name, action, snapshot) } : field,
  );
}

export async function classifyTranscript(
  transcript: string,
  snapshot: ProjectSnapshot = EMPTY_SNAPSHOT,
  requestJson: typeof chatJson = chatJson,
): Promise<ProposedAction[]> {
  const clean = transcript.trim();
  if (!clean) return [];

  const raw = await requestJson([
    { role: "system", content: `${CLASSIFY_SYSTEM}\n\n${snapshotPrompt(snapshot)}` },
    { role: "user", content: clean },
  ]);

  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) return [];

  // Validate each action on its own and keep the ones that pass; a malformed
  // action is dropped instead of sinking the whole report.
  const actions: ProposedAction[] = [];
  for (const candidate of envelope.data.actions) {
    const parsed = actionSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const normalized = normalizeAction(parsed.data, snapshot);
    if (normalized) actions.push({ ...normalized, missing: computeMissing(normalized, snapshot) });
  }
  return actions;
}

export async function transcribeAndClassify(
  audio: Blob,
  fileName: string,
  snapshot: ProjectSnapshot,
): Promise<VoiceReport> {
  const startedAt = Date.now();
  const transcript = await translateAudioToEnglish(audio, fileName);
  const transcribedAt = Date.now();
  if (!transcript) throw new BadRequestError("That recording was empty or inaudible");
  const actions = await classifyTranscript(transcript, snapshot);
  // Split timing so the slow leg is obvious in the logs: Whisper is bound by audio
  // duration, classify by the LLM model, and a big `bytes` points at the upload.
  logger.info(
    {
      bytes: audio.size,
      whisperMs: transcribedAt - startedAt,
      classifyMs: Date.now() - transcribedAt,
      transcriptChars: transcript.length,
      actions: actions.length,
    },
    "voice-report processed",
  );
  return { transcript, actions };
}

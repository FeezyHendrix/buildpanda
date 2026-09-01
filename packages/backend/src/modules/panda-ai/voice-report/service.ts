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

const dailyLogPayload = z.object({ bodyText: z.string().min(1) });

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
  stageId: z.string().min(1).nullish(),
  status: z.enum(["Pending", "InProgress", "Done"]).nullish(),
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

const dailyLogUpdatePayload = z.object({ totalHours: z.number().min(0) });

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

const CLASSIFY_SYSTEM = `You convert a spoken site update from a construction crew member into the field actions they are asking for. You draft for review — a human confirms every action before it runs — so extract exactly what was said and never invent details.

CREATE actions:
- "rfi": a question for the design team/client. payload { subject, question, priority? "Low"|"Normal"|"High" }.
- "daily_log": a site-diary note (work done, deliveries, weather, delays). payload { bodyText } — one clean sentence, keep first person.
- "change_request": a change to contracted scope, cost or programme. payload { title, description?, reason? }.
- "material_log": a material movement that ALREADY HAPPENED on site. entryType "IN" = received/delivered/arrived; "USED" = consumed/installed. payload { entryType, materialName, quantity, unit, locationKey?, reason? }. "received 30 bags of cement" => material_log IN, never material_order.
- "material_order": FUTURE procurement — need/order/request/buy. payload { title, materialName, quantity, unit, supplier? }. Only when material AND quantity were stated and it is a request, not a receipt.
- "look_ahead": a forward plan for a date range. payload { name, description?, startDate YYYY-MM-DD, endDate YYYY-MM-DD, totalWorkers?, buildingId? }. Resolve relative dates against TODAY; set a date to null only if none can be worked out.
- "transition_stage": start or complete a build stage ("we've started/finished X"). payload { stageId, status "InProgress" (started) | "Done" (completed) | "Pending", buildingId? }. stageId MUST come from the stage list below; set it to null if no stage clearly matches.

UPDATE / DELETE actions — allowed ONLY against the EXISTING RECORDS list below; copy the id exactly:
- "update_rfi": payload { rfiId, patch { subject?, question?, priority?, dueDate? } }.
- "transition_rfi": close, void or reopen an RFI. payload { rfiId, status "Closed"|"Void"|"Open" }.
- "update_change_request": payload { changeRequestId, patch { title?, description?, reason?, costImpact?, timeImpactDays? } }.
- "delete_change_request": payload { changeRequestId }.
- "update_material_order": e.g. "change the cement order to 50 bags". payload { orderId, patch { title?, materialName?, quantity?, unit?, supplier? } }.
- "delete_material_order": cancel a procurement request. payload { orderId }.
- "update_look_ahead": payload { lookAheadId, patch { name?, description?, startDate?, endDate?, totalWorkers? } }.
- "delete_look_ahead": payload { lookAheadId }.
- "update_daily_log": set today's total hours. payload { totalHours }.
- "log_activity": record work done against a scheduled activity today, optionally with a delay. payload { activityId, hoursLogged, delayReasonCode?, delayNote? }. delayReasonCode must come from DELAY REASONS below.
- "comment_rfi": add a response/comment to an RFI. payload { rfiId, body }.
- "comment_change_request": add a comment to a change request. payload { changeRequestId, body }.
- "void_ledger_entry": void a wrongly logged material movement. payload { entryId, reason }.
- "void_daily_log_entry": void one of today's diary entries. payload { entryId, reason }.

Rules:
- Extract every distinct action — one update can yield several.
- Keep numbers, names, drawing references and measurements exactly as spoken.
- Never fabricate quantities, dates, suppliers, costs or ids. If a required field was not stated and cannot be worked out, set it to null and STILL propose the action — the reviewer is shown the blank fields and fills them in. Do not downgrade a request into a daily_log just because a detail is missing.
- Material nuance: received/arrived/delivered = material_log IN; used/installed/consumed = material_log USED; need/request/order = material_order; "change/cancel the order" = update_material_order/delete_material_order.
- Only propose an update or delete when the speech clearly refers to one record in EXISTING RECORDS; if nothing matches, fall back to a daily_log note of what was said. This fallback is for updates to records that do not exist — never for a create whose fields are merely incomplete.
- "title" is a short label (max ~8 words). "summary" is one plain-English line describing what will happen, for the review card.
- If nothing actionable was said, return an empty actions array.

Return JSON exactly: { "actions": [ { "kind", "title", "summary", "payload" } ] }`;

function snapshotPrompt(snapshot: ProjectSnapshot): string {
  const lines: string[] = [
    `TODAY: ${snapshot.today}. Resolve every relative date ("today", "tomorrow", "next Monday") against it and output YYYY-MM-DD.`,
    "",
    "EXISTING RECORDS (the only valid update/delete targets):",
  ];
  for (const r of snapshot.rfis) lines.push(`- rfi ${r.id} — RFI-${r.number} "${r.subject}" (${r.status})`);
  for (const c of snapshot.changeRequests) lines.push(`- change_request ${c.id} — "${c.title}" (${c.status})`);
  for (const m of snapshot.materialOrders)
    lines.push(`- material_order ${m.id} — "${m.title}" ${m.quantity} ${m.unit} of ${m.materialName} (${m.status})`);
  for (const l of snapshot.lookAheads)
    lines.push(`- look_ahead ${l.id} — "${l.name}" ${l.startDate}→${l.endDate} (${l.status})`);
  for (const a of snapshot.activities) lines.push(`- activity ${a.id} — "${a.name}" (${a.status})`);
  for (const e of snapshot.ledgerEntries)
    lines.push(`- ledger_entry ${e.id} — ${e.entryType} ${e.quantity} ${e.unit} of ${e.materialName}`);
  for (const e of snapshot.todayEntries)
    lines.push(`- diary_entry ${e.id} — ${e.authorName}: "${e.snippet}"`);
  for (const s of snapshot.stages)
    lines.push(`- stage ${s.id} — "${s.name}" (${s.status}) building ${s.buildingId}`);
  for (const b of snapshot.buildings)
    lines.push(`- building ${b.id} — "${b.name}"${b.code ? ` (${b.code})` : ""}`);

  if (snapshot.delayReasons.length > 0) {
    lines.push("", "DELAY REASONS (the only valid delayReasonCode values):");
    for (const d of snapshot.delayReasons) lines.push(`- ${d.code} — ${d.name}`);
  }
  return lines.join("\n");
}

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

const BUILDING_SCOPED_KINDS = new Set(["look_ahead", "transition_stage"]);

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
  const payload = action.payload as Record<string, unknown>;
  const missing = requiredFields(action).filter((field) => {
    const value = payload[field.name];
    return value === null || value === undefined || value === "";
  });

  if (BUILDING_SCOPED_KINDS.has(action.kind) && snapshot.buildings.length > 1 && !payload["buildingId"]) {
    missing.unshift({ name: "buildingId", label: "Building", type: "select" });
  }

  return missing.map((field) =>
    field.type === "select" ? { ...field, options: optionsFor(field.name, action, snapshot) } : field,
  );
}

export async function classifyTranscript(
  transcript: string,
  snapshot: ProjectSnapshot = EMPTY_SNAPSHOT,
): Promise<ProposedAction[]> {
  const clean = transcript.trim();
  if (!clean) return [];

  const raw = await chatJson([
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

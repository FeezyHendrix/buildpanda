import { z } from "zod";
import { BadRequestError } from "../../../lib/errors.ts";
import { chatJson } from "../../../lib/llm.ts";
import { logger } from "../../../lib/logger.ts";
import { translateAudioToEnglish } from "../../../lib/speech.ts";
import type { ProjectSnapshot, ProposedAction, VoiceReport } from "./types.ts";

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

const lookAheadPayload = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  totalWorkers: z.number().nullish(),
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
]);

const envelopeSchema = z.object({ actions: z.array(z.unknown()) });

const EMPTY_SNAPSHOT: ProjectSnapshot = {
  rfis: [],
  changeRequests: [],
  materialOrders: [],
  lookAheads: [],
};

const CLASSIFY_SYSTEM = `You convert a spoken site update from a construction crew member into the field actions they are asking for. You draft for review — a human confirms every action before it runs — so extract exactly what was said and never invent details.

CREATE actions:
- "rfi": a question for the design team/client. payload { subject, question, priority? "Low"|"Normal"|"High" }.
- "daily_log": a site-diary note (work done, deliveries, weather, delays). payload { bodyText } — one clean sentence, keep first person.
- "change_request": a change to contracted scope, cost or programme. payload { title, description?, reason? }.
- "material_log": a material movement that ALREADY HAPPENED on site. entryType "IN" = received/delivered/arrived; "USED" = consumed/installed. payload { entryType, materialName, quantity, unit, locationKey?, reason? }. "received 30 bags of cement" => material_log IN, never material_order.
- "material_order": FUTURE procurement — need/order/request/buy. payload { title, materialName, quantity, unit, supplier? }. Only when material AND quantity were stated and it is a request, not a receipt.
- "look_ahead": a forward plan for a date range. payload { name, description?, startDate YYYY-MM-DD, endDate YYYY-MM-DD, totalWorkers? }. Only with explicit dates.

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

Rules:
- Extract every distinct action — one update can yield several.
- Keep numbers, names, drawing references and measurements exactly as spoken.
- Never fabricate quantities, dates, suppliers, costs or ids. Skip an action whose required fields were not stated.
- Material nuance: received/arrived/delivered = material_log IN; used/installed/consumed = material_log USED; need/request/order = material_order; "change/cancel the order" = update_material_order/delete_material_order.
- Only propose an update or delete when the speech clearly refers to one record in EXISTING RECORDS; if nothing matches, fall back to a daily_log note of what was said.
- "title" is a short label (max ~8 words). "summary" is one plain-English line describing what will happen, for the review card.
- If nothing actionable was said, return an empty actions array.

Return JSON exactly: { "actions": [ { "kind", "title", "summary", "payload" } ] }`;

function snapshotPrompt(snapshot: ProjectSnapshot): string {
  const lines: string[] = ["EXISTING RECORDS (the only valid update/delete targets):"];
  for (const r of snapshot.rfis) lines.push(`- rfi ${r.id} — RFI-${r.number} "${r.subject}" (${r.status})`);
  for (const c of snapshot.changeRequests) lines.push(`- change_request ${c.id} — "${c.title}" (${c.status})`);
  for (const m of snapshot.materialOrders)
    lines.push(`- material_order ${m.id} — "${m.title}" ${m.quantity} ${m.unit} of ${m.materialName} (${m.status})`);
  for (const l of snapshot.lookAheads)
    lines.push(`- look_ahead ${l.id} — "${l.name}" ${l.startDate}→${l.endDate} (${l.status})`);
  if (lines.length === 1) lines.push("- none");
  return lines.join("\n");
}

function isValidTarget(action: ProposedAction, snapshot: ProjectSnapshot): boolean {
  switch (action.kind) {
    case "update_rfi":
    case "transition_rfi":
      return snapshot.rfis.some((r) => r.id === action.payload.rfiId);
    case "update_change_request":
    case "delete_change_request":
      return snapshot.changeRequests.some((c) => c.id === action.payload.changeRequestId);
    case "update_material_order":
    case "delete_material_order":
      return snapshot.materialOrders.some((m) => m.id === action.payload.orderId);
    case "update_look_ahead":
    case "delete_look_ahead":
      return snapshot.lookAheads.some((l) => l.id === action.payload.lookAheadId);
    default:
      return true;
  }
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
  // action is dropped instead of sinking the whole report. Update/delete
  // actions must additionally target an id present in the project snapshot —
  // that is the guard against the model inventing a record id.
  const actions: ProposedAction[] = [];
  for (const candidate of envelope.data.actions) {
    const parsed = actionSchema.safeParse(candidate);
    if (parsed.success && isValidTarget(parsed.data, snapshot)) actions.push(parsed.data);
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

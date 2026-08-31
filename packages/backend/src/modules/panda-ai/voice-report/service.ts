import { z } from "zod";
import { BadRequestError } from "../../../lib/errors.ts";
import { chatJson } from "../../../lib/llm.ts";
import { logger } from "../../../lib/logger.ts";
import { translateAudioToEnglish } from "../../../lib/speech.ts";
import type { ProposedAction, VoiceReport } from "./types.ts";

const rfiPayload = z.object({
  subject: z.string().min(1),
  question: z.string().min(1),
  priority: z.enum(["Low", "Normal", "High"]).optional(),
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

const lookAheadPayload = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  totalWorkers: z.number().nullish(),
});

const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rfi"), title: z.string().min(1), summary: z.string(), payload: rfiPayload }),
  z.object({ kind: z.literal("daily_log"), title: z.string().min(1), summary: z.string(), payload: dailyLogPayload }),
  z.object({ kind: z.literal("change_request"), title: z.string().min(1), summary: z.string(), payload: changeRequestPayload }),
  z.object({ kind: z.literal("material_order"), title: z.string().min(1), summary: z.string(), payload: materialOrderPayload }),
  z.object({ kind: z.literal("look_ahead"), title: z.string().min(1), summary: z.string(), payload: lookAheadPayload }),
]);

const envelopeSchema = z.object({ actions: z.array(z.unknown()) });

const CLASSIFY_SYSTEM = `You convert a spoken site update from a construction crew member into the field records they are asking to create. You are drafting for review — a human confirms every record before it is saved, so extract what was clearly said and never invent details.

Record types you may propose:
- "rfi": a Request For Information — a question for the design team or client. payload: { subject, question, priority? one of "Low"|"Normal"|"High" }.
- "daily_log": a note for today's site diary — work done, deliveries, weather, delays, headcount. payload: { bodyText } — one clean sentence, keep first person.
- "change_request": a change to the contracted scope, cost or programme. payload: { title, description?, reason? }.
- "material_order": a request to order or deliver materials. payload: { title, materialName, quantity (number), unit, supplier? }. Only propose this if BOTH a material and a quantity were stated.
- "look_ahead": a short-term forward plan for a date range. payload: { name, description?, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), totalWorkers? }. Only propose this if explicit dates were given.

Rules:
- Extract every distinct actionable record — one update can yield several.
- Keep numbers, names, drawing references and measurements exactly as spoken.
- Never fabricate quantities, dates, suppliers or costs. Omit an optional field rather than guess, and skip a whole action when its required fields were not stated.
- "title" is a short label (max ~8 words). "summary" is a one-line plain-English description of what will be created, for the review card.
- If nothing actionable was said, return an empty actions array.

Return JSON exactly: { "actions": [ { "kind", "title", "summary", "payload" } ] }`;

export async function classifyTranscript(transcript: string): Promise<ProposedAction[]> {
  const clean = transcript.trim();
  if (!clean) return [];

  const raw = await chatJson([
    { role: "system", content: CLASSIFY_SYSTEM },
    { role: "user", content: clean },
  ]);

  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) return [];

  // Validate each action on its own and keep the ones that pass. The model
  // occasionally emits an incomplete record (an order with no quantity) among
  // good ones; dropping just that one beats failing the whole report and losing
  // every record the crew member actually dictated.
  const actions: ProposedAction[] = [];
  for (const candidate of envelope.data.actions) {
    const parsed = actionSchema.safeParse(candidate);
    if (parsed.success) actions.push(parsed.data);
  }
  return actions;
}

export async function transcribeAndClassify(audio: Blob, fileName: string): Promise<VoiceReport> {
  const startedAt = Date.now();
  const transcript = await translateAudioToEnglish(audio, fileName);
  const transcribedAt = Date.now();
  if (!transcript) throw new BadRequestError("That recording was empty or inaudible");
  const actions = await classifyTranscript(transcript);
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

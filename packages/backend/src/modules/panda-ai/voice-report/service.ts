import { classifySystem, snapshotPrompt } from "./prompt.ts";
import { z } from "zod";
import { BadRequestError } from "../../../lib/errors.ts";
import { chatJson } from "../../../lib/llm.ts";
import { logger } from "../../../lib/logger.ts";
import { translateAudioToEnglish } from "../../../lib/speech.ts";
import { actionSchema } from "./action-schemas.ts";
import { collectReviewFields, computeMissing, normalizeAction } from "./legacy-review.ts";
import { isExtendedAction, parseExtendedAction, reviewFields, fieldComplete } from "@buildpanda/voice-actions";
import type {
  ProjectSnapshot,
  ProposedAction,
  VoiceReport,
} from "./types.ts";

const envelopeSchema = z.object({ actions: z.array(z.unknown()) });



const EMPTY_SNAPSHOT: ProjectSnapshot = {
  rfis: [],
  changeRequests: [],
  materialOrders: [],
  lookAheads: [],
  activities: [],
  delayReasons: [],
  ledgerEntries: [],
  materials: [],
  todayEntries: [],
  stages: [],
  buildings: [],
  dailyLogForm: null,
  today: new Date().toISOString().slice(0, 10),
};

export async function classifyTranscript(
  transcript: string,
  snapshot: ProjectSnapshot = EMPTY_SNAPSHOT,
  requestJson: typeof chatJson = chatJson,
): Promise<ProposedAction[]> {
  const clean = transcript.trim();
  if (!clean) return [];

  const raw = await requestJson([
    { role: "system", content: `${classifySystem(snapshot.allowedActionKinds)}\n\n${snapshotPrompt(snapshot)}` },
    { role: "user", content: clean },
  ]);

  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) return [];

  // Validate each action on its own and keep the ones that pass; a malformed
  // action is dropped instead of sinking the whole report.
  const actions: ProposedAction[] = [];
  for (const candidate of envelope.data.actions) {
    const kind = candidate && typeof candidate === "object" ? (candidate as { kind?: unknown }).kind : null;
    if (snapshot.allowedActionKinds && (typeof kind !== "string" || !snapshot.allowedActionKinds.includes(kind))) continue;
    if (typeof kind === "string" && isExtendedAction(kind)) {
      const options = snapshot.voiceOptions ?? {};
      const action = parseExtendedAction(candidate, options);
      if (action) actions.push({ ...action, reviewOptions: options, missing: reviewFields(action, options)
        .filter((field) => !fieldComplete(field, (action.payload as Record<string, unknown>)[field.name])) });
      continue;
    }
    const parsed = actionSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const normalized = normalizeAction(parsed.data, snapshot);
    if (normalized) actions.push({ ...normalized, missing: computeMissing(normalized, snapshot), reviewFields: collectReviewFields(normalized, snapshot) });
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

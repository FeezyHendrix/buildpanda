import { z } from "zod";
import { config } from "../config/index.ts";
import { BadRequestError } from "./errors.ts";
import { chatJsonValidated } from "./llm.ts";

/**
 * Dictation helpers shared by every capture surface — RFI comments today, daily
 * logs and inspection notes next. Kept out of any one module so a second caller
 * doesn't copy the Whisper wiring.
 */

export function isDictationConfigured(): boolean {
  return config.openai.apiKey !== "";
}

/**
 * Transcribes *and* translates to English in one call.
 *
 * `/audio/translations` is deliberate: it accepts any spoken language and
 * always returns English, so a crew member never has to declare their language
 * first. `/audio/transcriptions` would return the source language instead.
 */
export async function translateAudioToEnglish(audio: Blob, fileName: string): Promise<string> {
  const { apiKey, baseUrl, timeoutMs } = config.openai;
  if (!apiKey) throw new BadRequestError("Dictation is not configured on this environment");

  const form = new FormData();
  form.append("file", audio, fileName);
  form.append("model", "whisper-1");
  form.append("response_format", "text");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/audio/translations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new BadRequestError(`Could not transcribe that recording (${response.status})`);
    }
    return (await response.text()).trim();
  } finally {
    clearTimeout(timer);
  }
}

const FORMAT_SYSTEM = `You tidy dictated site notes for a construction record.
Rules:
- Keep every fact, number, name, drawing reference and measurement exactly as spoken.
- Fix punctuation, capitalisation and obvious speech-to-text errors only.
- Remove filler ("um", "you know", repeated false starts).
- Do not add information, opinions, greetings or sign-offs.
- Do not answer the question or offer advice; you are formatting, not replying.
- Keep first person if that is how it was spoken.
Return JSON: { "formatted": string }`;

const formattedSchema = z.object({ formatted: z.string() });

/**
 * Cleans a raw transcript into something fit for a written record.
 *
 * Falls back to the transcript when the model is unavailable — a rough note the
 * author can edit beats losing what they said.
 */
export async function formatDictatedText(transcript: string): Promise<string> {
  if (!transcript.trim()) return transcript;

  try {
    const result = await chatJsonValidated(
      [
        { role: "system", content: FORMAT_SYSTEM },
        { role: "user", content: transcript },
      ],
      formattedSchema,
    );
    return result?.data.formatted.trim() || transcript;
  } catch {
    return transcript;
  }
}

export interface DictationResult {
  /** Whisper's English output, untouched — the record of what was said. */
  transcript: string;
  /** Tidied for a written record. Always reviewed by the author before posting. */
  formatted: string;
}

export async function dictate(audio: Blob, fileName: string): Promise<DictationResult> {
  const transcript = await translateAudioToEnglish(audio, fileName);
  if (!transcript) throw new BadRequestError("That recording was empty or inaudible");
  return { transcript, formatted: await formatDictatedText(transcript) };
}

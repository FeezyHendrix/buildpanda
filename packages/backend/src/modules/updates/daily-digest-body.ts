import { z } from "zod";
import { isPandaAiConfigured, pandaAiJson } from "../panda-ai/engine.ts";
import type { DailyDigestContext } from "./types.ts";

// The route schema caps an update description at 2000 characters.
const MAX_BODY_LENGTH = 2000;

const digestBodySchema = z.object({ body: z.unknown().optional() });

function clampToSentence(text: string): string {
  if (text.length <= MAX_BODY_LENGTH) return text;
  const cut = text.slice(0, MAX_BODY_LENGTH);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"));
  return lastStop > 0 ? cut.slice(0, lastStop + 1) : cut.trimEnd();
}

const SYSTEM_PROMPT = [
  "You are Panda AI, writing the internal end-of-day digest for the build team on a construction project.",
  "The audience is the project manager and the site team — NOT the homeowner or client. Write in normal construction language; do not soften, sell, or explain basic terms.",
  "Use ONLY the facts in the provided JSON. Never invent work, dates, quantities, amounts or people that are not in the data. Repeat every number, name and date exactly as given.",
  "Lead with what physically happened on site, then what moved through the paperwork (RFIs, approvals, queries, change requests, action items, tasks), then materials, drawings, documents and anything recorded against the money.",
  "Call out what now needs a decision or is blocking work. If the site notes describe a problem, say so plainly rather than burying it.",
  "Write short plain-text paragraphs separated by blank lines. No markdown, no headings, no bullet symbols, no emojis.",
  "Never state or imply that the system moved, paid or transferred money — financial lines are records of something a person did off-platform.",
  `Keep the whole digest under ${MAX_BODY_LENGTH - 200} characters.`,
  'Respond with JSON: {"body": "<the digest text>"}.',
].join(" ");

function siteParagraph(context: DailyDigestContext): string[] {
  const lines: string[] = [];
  const log = context.siteLog;

  if (log) {
    const crew = `${log.workersPresent} of ${log.workersExpected} expected workers on site`;
    const hours = log.totalHours > 0 ? `, ${log.totalHours} hours logged` : "";
    const weather = log.weather ? `. Weather: ${log.weather}` : "";
    const temp = log.temperatureC !== null ? ` at ${log.temperatureC}°C` : "";
    lines.push(`${crew}${hours}${weather}${temp}.`);
  } else {
    lines.push("No daily log was filed for this day.");
  }

  for (const activity of context.loggedActivities) {
    lines.push(`- ${activity.name}: ${activity.hours} hour(s) logged.`);
  }
  for (const note of context.siteNotes) {
    lines.push(`- ${note.author}: ${note.body}`);
  }

  return lines;
}

// Deterministic digest used when no LLM key is configured (dev mode) or the
// model returns nothing usable — assembled from the same gathered facts.
export function buildFallbackBody(context: DailyDigestContext): string {
  const lines: string[] = [`Site — ${context.dateLabel}`, ...siteParagraph(context)];

  if (context.currentStage) {
    lines.push("", `Current stage: ${context.currentStage} (${context.progressPercent}% overall).`);
  }

  for (const section of context.sections) {
    lines.push("", `${section.heading}:`);
    for (const item of section.items) {
      lines.push(`- ${item}`);
    }
  }

  return clampToSentence(lines.join("\n"));
}

export async function generateDigestBody(context: DailyDigestContext): Promise<string> {
  if (isPandaAiConfigured()) {
    const result = await pandaAiJson(SYSTEM_PROMPT, JSON.stringify(context), digestBodySchema);
    const body = result?.body;
    if (typeof body === "string" && body.trim().length > 0) {
      return clampToSentence(body.trim());
    }
  }
  return buildFallbackBody(context);
}

import { z } from "zod";
import { pandaAiJson } from "./engine.ts";

const phaseDetectionSchema = z.object({ phases: z.unknown().optional() });

export interface DetectedPhase {
  name: string;
  durationWeeks: number;
}

export interface PhaseDetectionResult {
  phases: DetectedPhase[];
  usedAi: boolean;
}

const SYSTEM_PROMPT = `You are a construction project planner. Given a project name and a list of materials and work items extracted from its Bill of Quantities, produce a realistic, ordered set of build phases for the project schedule. Phases must follow natural construction sequence (e.g. site preparation, substructure, superstructure, services, finishes, external works, handover). Use clear, conventional phase names. Estimate a sensible duration in whole weeks for each phase based on the scope implied by the materials. Return between 4 and 10 phases. Respond ONLY with JSON of this exact shape:
{ "phases": [ { "name": string, "durationWeeks": number } ] }`;

const FALLBACK_PHASES: readonly DetectedPhase[] = [
  { name: "Site Preparation", durationWeeks: 2 },
  { name: "Substructure", durationWeeks: 6 },
  { name: "Superstructure", durationWeeks: 10 },
  { name: "Building Services", durationWeeks: 6 },
  { name: "Finishes", durationWeeks: 8 },
  { name: "External Works", durationWeeks: 4 },
  { name: "Testing & Handover", durationWeeks: 2 },
];

const KEYWORD_PHASES: ReadonlyArray<{ phase: DetectedPhase; keywords: readonly string[] }> = [
  { phase: { name: "Site Preparation", durationWeeks: 2 }, keywords: ["site", "clearance", "excavat", "survey", "setting out"] },
  { phase: { name: "Substructure", durationWeeks: 6 }, keywords: ["foundation", "footing", "substructure", "blinding", "dpc", "hardcore"] },
  { phase: { name: "Superstructure", durationWeeks: 10 }, keywords: ["concrete", "rebar", "reinforcement", "column", "beam", "slab", "block", "brick", "steel", "frame", "roof"] },
  { phase: { name: "Building Services", durationWeeks: 6 }, keywords: ["electric", "plumb", "pipe", "cable", "mechanical", "hvac", "wiring", "duct"] },
  { phase: { name: "Finishes", durationWeeks: 8 }, keywords: ["plaster", "paint", "tile", "ceiling", "door", "window", "floor", "finish", "screed"] },
  { phase: { name: "External Works", durationWeeks: 4 }, keywords: ["drainage", "landscap", "paving", "fence", "external", "road", "kerb"] },
];

function normalizePhases(value: { phases?: unknown } | null): DetectedPhase[] {
  if (!value || !Array.isArray(value.phases)) return [];
  const out: DetectedPhase[] = [];
  for (const item of value.phases) {
    if (!item || typeof item !== "object") continue;
    const name = String((item as { name?: unknown }).name ?? "").trim();
    if (!name) continue;
    const weeksRaw = Number((item as { durationWeeks?: unknown }).durationWeeks);
    const durationWeeks = Number.isFinite(weeksRaw) && weeksRaw > 0 ? Math.round(weeksRaw) : 4;
    out.push({ name: name.slice(0, 120), durationWeeks });
  }
  return out.slice(0, 12);
}

function deterministicPhases(materialNames: string[]): DetectedPhase[] {
  if (materialNames.length === 0) return [...FALLBACK_PHASES];
  const haystack = materialNames.join(" ").toLowerCase();
  const matched = KEYWORD_PHASES.filter((entry) =>
    entry.keywords.some((kw) => haystack.includes(kw)),
  ).map((entry) => entry.phase);
  if (matched.length === 0) return [...FALLBACK_PHASES];
  return [...matched, { name: "Testing & Handover", durationWeeks: 2 }];
}

export async function detectPhases(
  projectName: string,
  materialNames: string[],
): Promise<PhaseDetectionResult> {
  const sample = materialNames.slice(0, 120);
  const userPrompt = `Project: ${projectName}\n\nMaterials and work items:\n${sample.map((m) => `- ${m}`).join("\n")}`;
  try {
    const parsed = await pandaAiJson(SYSTEM_PROMPT, userPrompt, phaseDetectionSchema);
    const phases = normalizePhases(parsed);
    if (phases.length > 0) return { phases, usedAi: true };
  } catch {
    void 0;
  }
  return { phases: deterministicPhases(materialNames), usedAi: false };
}

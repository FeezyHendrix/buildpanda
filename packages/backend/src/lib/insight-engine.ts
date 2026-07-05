import { chatJson, isLlmConfigured, activeModelName, type LlmMessage } from "./llm.ts";
import { analyzeMetrics } from "../modules/panda-ai/analyzer.ts";
import type {
  AiInsightResult,
  AiSuggestion,
  ProjectMetrics,
  SuggestionPriority,
} from "../modules/panda-ai/types.ts";

const SYSTEM_PROMPT = `You are Panda AI, a senior construction project advisor embedded in the BuildPanda platform. You analyse a single project's live metrics and produce concise, actionable guidance for the project manager. Be specific and reference the numbers. Never invent data that is not in the metrics. Respond ONLY with a JSON object matching this exact shape:
{
  "summary": string (2-3 sentences),
  "healthScore": integer 0-100,
  "suggestions": [
    { "title": string, "detail": string, "priority": "high"|"medium"|"low", "category": string }
  ]
}
Provide between 1 and 6 suggestions, ordered most important first.`;

const PRIORITIES: ReadonlySet<string> = new Set(["high", "medium", "low"]);

function coerceSuggestions(value: unknown): AiSuggestion[] {
  if (!Array.isArray(value)) return [];
  const result: AiSuggestion[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj["title"] !== "string" || typeof obj["detail"] !== "string") {
      continue;
    }
    const priority = PRIORITIES.has(obj["priority"] as string)
      ? (obj["priority"] as SuggestionPriority)
      : "medium";
    result.push({
      title: obj["title"],
      detail: obj["detail"],
      priority,
      category:
        typeof obj["category"] === "string" ? obj["category"] : "General",
    });
  }
  return result;
}

function parseResult(parsed: unknown): AiInsightResult | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  const suggestions = coerceSuggestions(obj["suggestions"]);
  if (typeof obj["summary"] !== "string" || suggestions.length === 0) {
    return null;
  }
  const rawScore = Number(obj["healthScore"]);
  // An unusable score is a failed analysis, not a 70 — reject so the caller
  // falls back to the deterministic analyzer instead of inventing a number.
  if (!Number.isFinite(rawScore)) return null;
  return {
    summary: obj["summary"],
    suggestions,
    healthScore: Math.max(0, Math.min(100, Math.round(rawScore))),
    model: activeModelName() ?? "unknown",
  };
}

export interface InsightEngineOutcome extends AiInsightResult {
  usedFallback: boolean;
}

/**
 * LLM-scored insights via the shared client (OpenAI preferred, Kimi otherwise
 * — see activeProvider in lib/llm.ts); deterministic analyzer as fallback.
 */
export async function generateInsights(
  metrics: ProjectMetrics,
): Promise<InsightEngineOutcome> {
  if (isLlmConfigured()) {
    try {
      const messages: LlmMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyse this project and respond with the JSON object. Metrics:\n${JSON.stringify(metrics, null, 2)}`,
        },
      ];
      const result = parseResult(await chatJson(messages));
      if (result) {
        return { ...result, usedFallback: false };
      }
    } catch {
      // Fall through to the deterministic analyzer below.
    }
  }
  return { ...analyzeMetrics(metrics), usedFallback: true };
}

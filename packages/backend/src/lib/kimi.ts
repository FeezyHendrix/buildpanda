import { config } from "../config/index.ts";
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

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

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

function parseResult(content: string): AiInsightResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  const suggestions = coerceSuggestions(obj["suggestions"]);
  if (typeof obj["summary"] !== "string" || suggestions.length === 0) {
    return null;
  }
  const rawScore = Number(obj["healthScore"]);
  const healthScore = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(100, Math.round(rawScore)))
    : 70;
  return {
    summary: obj["summary"],
    suggestions,
    healthScore,
    model: config.ai.model,
  };
}

async function callMoonshot(
  metrics: ProjectMetrics,
): Promise<AiInsightResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
  try {
    const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.ai.model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Analyse this project and respond with the JSON object. Metrics:\n${JSON.stringify(metrics, null, 2)}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Moonshot API returned ${response.status}: ${await response.text()}`,
      );
    }
    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseResult(content);
  } finally {
    clearTimeout(timer);
  }
}

export interface InsightEngineOutcome extends AiInsightResult {
  usedFallback: boolean;
}

export async function generateInsights(
  metrics: ProjectMetrics,
): Promise<InsightEngineOutcome> {
  if (config.ai.apiKey) {
    try {
      const result = await callMoonshot(metrics);
      if (result) {
        return { ...result, usedFallback: false };
      }
    } catch {
      // Fall through to the deterministic analyzer below.
    }
  }
  return { ...analyzeMetrics(metrics), usedFallback: true };
}

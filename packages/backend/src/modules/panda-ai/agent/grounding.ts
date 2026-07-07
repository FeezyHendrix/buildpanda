import type { LlmMessage } from "../../../lib/llm.ts";

// A tool result counts as substantive only if it carries real project data:
// not an error, and not an empty collection / null / empty object. This is what
// the grounding gate keys off to decide whether the model has anything to stand
// on before it answers.
export function isSubstantiveToolResult(output: unknown): boolean {
  if (output === null || output === undefined) return false;
  if (typeof output !== "object") return output !== "";
  const record = output as Record<string, unknown>;
  if ("error" in record) return false;
  if (Array.isArray(output)) return output.length > 0;

  const values = Object.values(record);
  if (values.length === 0) return false;
  return values.some((value) => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value as object).length > 0;
    return value !== "" && value !== 0;
  });
}

const REFUSAL_DIRECTIVE =
  "GROUNDING CHECK: every tool you called this turn returned no data (empty or error). " +
  "You have NO project data to answer from. Do not invent numbers, dates, names, or statuses. " +
  "Tell the user plainly that you could not find the requested information for this project, " +
  "and suggest what they could check or provide. Answer only with that.";

export interface GroundingDecision {
  conversation: LlmMessage[];
  refused: boolean;
}

// If the turn called tools but none returned substantive data, inject a hard
// directive so the final answer is an honest "no data" instead of a fabrication.
// When at least one tool produced data, or no tools were called, the
// conversation passes through unchanged.
export function applyGroundingGate(
  conversation: LlmMessage[],
  madeToolCalls: boolean,
  hadSubstantiveData: boolean,
): GroundingDecision {
  if (madeToolCalls && !hadSubstantiveData) {
    return {
      conversation: [...conversation, { role: "system", content: REFUSAL_DIRECTIVE }],
      refused: true,
    };
  }
  return { conversation, refused: false };
}

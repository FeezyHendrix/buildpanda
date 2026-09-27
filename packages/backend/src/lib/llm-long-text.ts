import type { ZodType } from "zod";
import { config } from "../config/index.ts";
import { activeProvider, chatJsonValidated, type LlmMessage, type Provider, type ValidatedJsonResult } from "./llm.ts";

// Text budget the callers used before a long-context provider existed; kept as
// the fallback so nothing changes on a deployment without a DeepSeek key.
export const DEFAULT_TEXT_CHARS = 24_000;

// Whole-document work (spec/BoQ extraction, schedule tables, bill build-up,
// programme drafts) goes to DeepSeek's 1M window when configured, otherwise to
// the active text provider with the historical budget.
export function longTextProvider(): Provider | null {
  if (config.deepseek.apiKey) return config.deepseek;
  return activeProvider();
}

export function longTextCharBudget(): number {
  return config.deepseek.apiKey ? config.deepseek.maxInputChars : DEFAULT_TEXT_CHARS;
}

export function chatLongJsonValidated<T>(
  messages: LlmMessage[],
  schema: ZodType<T>,
): Promise<ValidatedJsonResult<T> | null> {
  return chatJsonValidated(messages, schema, { provider: longTextProvider() });
}

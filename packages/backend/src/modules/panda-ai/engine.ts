import type { ZodType } from "zod";
import { chatJson, chatJsonValidated, isLlmConfigured, type LlmMessage } from "../../lib/llm.ts";

export type PandaAiMessage = LlmMessage;

export function isPandaAiConfigured(): boolean {
  return isLlmConfigured();
}

// Overload 1: no schema — legacy untyped path (returns parsed JSON as-is).
// Overload 2: with a schema — validated + repair-retried; a shape that fails
// validation throws LLMValidationError instead of being blind-cast to T.
export async function pandaAiJson<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
): Promise<T | null>;
export async function pandaAiJson<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: ZodType<T>,
): Promise<T | null>;
export async function pandaAiJson<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  schema?: ZodType<T>,
): Promise<T | null> {
  const messages: PandaAiMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
  if (schema) {
    const result = await chatJsonValidated(messages, schema);
    return result ? result.data : null;
  }
  return (await chatJson(messages)) as T | null;
}

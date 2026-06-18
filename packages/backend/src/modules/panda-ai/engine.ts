import { chatJson, isLlmConfigured, type LlmMessage } from "../../lib/llm.ts";

export type PandaAiMessage = LlmMessage;

export function isPandaAiConfigured(): boolean {
  return isLlmConfigured();
}

export async function pandaAiJson<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
): Promise<T | null> {
  const messages: PandaAiMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
  return (await chatJson(messages)) as T | null;
}

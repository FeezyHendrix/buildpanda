import { config } from "../config/index.ts";

export interface LlmMessage {
  role: "system" | "user";
  content: string;
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface Provider {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

function activeProvider(): Provider | null {
  if (config.openai.apiKey) return config.openai;
  if (config.ai.apiKey) return config.ai;
  return null;
}

export function isLlmConfigured(): boolean {
  return activeProvider() !== null;
}

export async function chatJson(messages: LlmMessage[]): Promise<unknown | null> {
  const provider = activeProvider();
  if (!provider) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), provider.timeoutMs);
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages,
      }),
    });
    if (!response.ok) {
      throw new Error(`LLM API ${response.status}: ${await response.text()}`);
    }
    const payload = (await response.json()) as ChatResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

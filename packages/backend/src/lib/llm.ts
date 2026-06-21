import { config } from "../config/index.ts";

export interface LlmTextContent {
  type: "text";
  text: string;
}

export interface LlmImageContent {
  type: "image_url";
  image_url: { url: string; detail?: "low" | "high" | "auto" };
}

export type LlmContent = string | Array<LlmTextContent | LlmImageContent>;

export interface LlmToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: LlmContent | null;
  tool_calls?: LlmToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface LlmTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string; tool_calls?: LlmToolCall[] } }>;
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

export function activeModelName(): string | null {
  return activeProvider()?.model ?? null;
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

export interface ChatTurnResult {
  content: string;
  toolCalls: LlmToolCall[];
}

export async function chatTools(
  messages: LlmMessage[],
  tools: LlmTool[],
  options: { signal?: AbortSignal } = {},
): Promise<ChatTurnResult | null> {
  const provider = activeProvider();
  if (!provider) return null;

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    signal: options.signal,
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.2,
      messages,
      ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(`LLM API ${response.status}: ${await response.text()}`);
  }
  const payload = (await response.json()) as ChatResponse;
  const message = payload.choices?.[0]?.message;
  return {
    content: message?.content ?? "",
    toolCalls: message?.tool_calls ?? [],
  };
}

export async function chatStream(
  messages: LlmMessage[],
  options: { onToken: (token: string) => void; signal?: AbortSignal },
): Promise<string> {
  const provider = activeProvider();
  if (!provider) return "";

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    signal: options.signal,
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.3,
      stream: true,
      messages,
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`LLM API ${response.status}: ${await response.text().catch(() => "stream error")}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
        const token = json.choices?.[0]?.delta?.content;
        if (token) {
          full += token;
          options.onToken(token);
        }
      } catch {
        continue;
      }
    }
  }
  return full;
}

export async function chatVision(
  textPrompt: string,
  images: string[],
  options: { detail?: "low" | "high"; signal?: AbortSignal } = {},
): Promise<string | null> {
  const provider = activeProvider();
  if (!provider) return null;

  const detail = options.detail ?? "low";
  const content: Array<LlmTextContent | LlmImageContent> = [
    { type: "text", text: textPrompt },
    ...images.map((url): LlmImageContent => ({ type: "image_url", image_url: { url, detail } })),
  ];

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    signal: options.signal,
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.2,
      messages: [{ role: "user", content }],
    }),
  });
  if (!response.ok) {
    throw new Error(`LLM API ${response.status}: ${await response.text()}`);
  }
  const payload = (await response.json()) as ChatResponse;
  return payload.choices?.[0]?.message?.content ?? null;
}

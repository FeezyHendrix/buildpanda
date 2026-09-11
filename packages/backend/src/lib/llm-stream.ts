import { activeProvider, emitCallRecord, type LlmMessage } from "./llm.ts";

interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

export async function chatStream(
  messages: LlmMessage[],
  options: { onToken: (token: string) => void; signal?: AbortSignal },
): Promise<string> {
  const provider = activeProvider();
  if (!provider) return "";

  const start = Date.now();
  let usage: ChatUsage | undefined;
  try {
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
        stream_options: { include_usage: true },
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
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: ChatUsage;
          };
          if (json.usage) usage = json.usage;
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
    emitCallRecord({
      modelVersion: provider.model,
      latencyMs: Date.now() - start,
      validationStatus: "unvalidated",
      retryCount: 0,
      tokensIn: usage?.prompt_tokens ?? null,
      tokensOut: usage?.completion_tokens ?? null,
    });
    return full;
  } catch (error) {
    emitCallRecord({
      modelVersion: provider.model,
      latencyMs: Date.now() - start,
      validationStatus: "failed",
      retryCount: 0,
      tokensIn: usage?.prompt_tokens ?? null,
      tokensOut: usage?.completion_tokens ?? null,
    });
    throw error;
  }
}

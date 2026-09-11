import { config } from "../config/index.ts";
import {
  activeProvider,
  emitCallRecord,
  type ChatResponse,
  type LlmImageContent,
  type LlmTextContent,
  type Provider,
} from "./llm.ts";

// Images go to DeepSeek (V4.1 Flash, vision-native) when a key is set; text and
// tool calls keep using the providers in `activeProvider`. Without a DeepSeek
// key the text provider receives the images, as before.
export function visionProvider(): Provider | null {
  if (config.deepseek.apiKey) return config.deepseek;
  return activeProvider();
}

export function isVisionConfigured(): boolean {
  return visionProvider() !== null;
}

export function activeVisionModelName(): string | null {
  return visionProvider()?.model ?? null;
}

export type VisionDetail = "low" | "high" | "auto";

export async function chatVision(
  textPrompt: string,
  images: string[],
  options: { detail?: VisionDetail; signal?: AbortSignal } = {},
): Promise<string | null> {
  const provider = visionProvider();
  if (!provider) return null;

  const detail = options.detail ?? "low";
  const content: Array<LlmTextContent | LlmImageContent> = [
    { type: "text", text: textPrompt },
    ...images.map((url): LlmImageContent => ({ type: "image_url", image_url: { url, detail } })),
  ];

  // A high-detail drawing page is a slow request; cap it with the provider
  // timeout even when the caller supplies its own abort signal.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), provider.timeoutMs);
  options.signal?.addEventListener("abort", () => controller.abort(), { once: true });

  const start = Date.now();
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
        temperature: 0.2,
        messages: [{ role: "user", content }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Vision API ${response.status}: ${await response.text()}`);
    }
    const payload = (await response.json()) as ChatResponse;
    emitCallRecord({
      modelVersion: provider.model,
      latencyMs: Date.now() - start,
      validationStatus: "unvalidated",
      retryCount: 0,
      tokensIn: payload.usage?.prompt_tokens ?? null,
      tokensOut: payload.usage?.completion_tokens ?? null,
    });
    return payload.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    emitCallRecord({
      modelVersion: provider.model,
      latencyMs: Date.now() - start,
      validationStatus: "failed",
      retryCount: 0,
    });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

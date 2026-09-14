import { config } from "../config/index.ts";
import { AppError } from "./errors.ts";

// Embeddings stay on OpenAI: it is the only configured provider with an
// embeddings endpoint, and the BESMM index is built at these dimensions.
export const EMBED_DIMENSIONS = 1536;

export function isEmbeddingConfigured(): boolean {
  return config.openai.apiKey !== "";
}

interface EmbedResponse {
  data: { embedding: number[] }[];
}

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const { apiKey, baseUrl, embedModel, timeoutMs } = config.openai;
  if (!apiKey) throw new AppError("OpenAI API key is not configured", { statusCode: 503, code: "embedding_unavailable" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({ model: embedModel, input: inputs }),
    });
    if (!response.ok) {
      throw new AppError(`Embedding API ${response.status}: ${await response.text()}`, { statusCode: 502, code: "embedding_failed" });
    }
    const payload = (await response.json()) as EmbedResponse;
    return payload.data.map((d) => d.embedding);
  } finally {
    clearTimeout(timer);
  }
}

export async function embedText(input: string): Promise<number[]> {
  const [vector] = await embedTexts([input]);
  if (!vector) throw new AppError("Embedding API returned no vector", { statusCode: 502, code: "embedding_failed" });
  return vector;
}

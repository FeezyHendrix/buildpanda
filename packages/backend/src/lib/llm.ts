import type { ZodType } from "zod";
import { config } from "../config/index.ts";
import { AppError } from "./errors.ts";
import { getLlmContext } from "./llm-context.ts";

// 502: a schema violation is an upstream (model) contract failure, not the caller's.
export class LLMValidationError extends AppError {
  constructor(message: string, details: { rawOutput: string | null; issues: unknown; retryCount: number }) {
    super(message, { statusCode: 502, code: "llm_validation_failed", details });
  }
}

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

interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string; tool_calls?: LlmToolCall[] } }>;
  usage?: ChatUsage;
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

export type LlmValidationStatus = "valid" | "repaired" | "failed" | "unvalidated";

export interface LlmCallRecord {
  promptId?: string | null;
  promptVersion?: string | null;
  modelVersion: string | null;
  seed?: string | null;
  latencyMs: number;
  validationStatus: LlmValidationStatus;
  retryCount: number;
  tokensIn?: number | null;
  tokensOut?: number | null;
  orgId?: string | null;
}

export type LlmCallSink = (record: LlmCallRecord) => void;

let callSink: LlmCallSink | null = null;

// Wired at app startup to persist call records (audit + eval substrate). Kept
// pluggable so lib/llm.ts stays DB-agnostic; unset in unit tests and CLIs.
export function setLlmCallSink(sink: LlmCallSink | null): void {
  callSink = sink;
}

function emitCallRecord(record: LlmCallRecord): void {
  if (!callSink) return;
  try {
    callSink({ ...record, orgId: record.orgId ?? getLlmContext()?.orgId ?? null });
  } catch {
    // Telemetry must never break a live LLM call.
    void 0;
  }
}

export interface JsonCompletionResult {
  content: string | null;
  usage?: ChatUsage;
}

// Extracted so validated and unvalidated callers share one transport, and so
// tests can exercise the envelope without a live provider. Returns the content
// plus optional token usage (absent when a provider omits it).
export type JsonCompletionTransport = (messages: LlmMessage[]) => Promise<JsonCompletionResult>;

const defaultJsonTransport: JsonCompletionTransport = async (messages) => {
  const provider = activeProvider();
  if (!provider) return { content: null };

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
    return { content: payload.choices?.[0]?.message?.content ?? null, usage: payload.usage };
  } finally {
    clearTimeout(timer);
  }
};

let jsonTransport: JsonCompletionTransport = defaultJsonTransport;

// Test seam: override the JSON transport so envelope behaviour (validation,
// repair-retry, error) is exercised without a live provider. Returns a restore fn.
export function setJsonTransportForTests(transport: JsonCompletionTransport): () => void {
  const previous = jsonTransport;
  jsonTransport = transport;
  return () => {
    jsonTransport = previous;
  };
}

export async function chatJson(messages: LlmMessage[]): Promise<unknown | null> {
  const { content } = await jsonTransport(messages);
  if (!content) return null;
  return JSON.parse(content);
}

export interface ValidatedJsonResult<T> {
  data: T;
  retryCount: number;
}

// Schema-validated JSON completion with one repair retry. On the first schema
// failure the model is re-prompted with its own output + the validation issues
// and asked to correct them; a second failure throws LLMValidationError so a
// hallucinated shape never reaches the caller as a blind cast.
export async function chatJsonValidated<T>(
  messages: LlmMessage[],
  schema: ZodType<T>,
): Promise<ValidatedJsonResult<T> | null> {
  const start = Date.now();
  const modelVersion = activeModelName();
  let usage: ChatUsage | undefined;
  const record = (validationStatus: LlmValidationStatus, retryCount: number): void => {
    emitCallRecord({
      modelVersion,
      latencyMs: Date.now() - start,
      validationStatus,
      retryCount,
      tokensIn: usage?.prompt_tokens ?? null,
      tokensOut: usage?.completion_tokens ?? null,
    });
  };

  const firstCall = await jsonTransport(messages);
  usage = firstCall.usage;
  const first = firstCall.content;
  if (first === null) return null;

  const attempt = (raw: string): { ok: true; value: T } | { ok: false; issues: unknown } => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { ok: false, issues: [{ message: error instanceof Error ? error.message : "invalid JSON" }] };
    }
    const result = schema.safeParse(parsed);
    return result.success ? { ok: true, value: result.data } : { ok: false, issues: result.error.issues };
  };

  const firstResult = attempt(first);
  if (firstResult.ok) {
    record("valid", 0);
    return { data: firstResult.value, retryCount: 0 };
  }

  const repairMessages: LlmMessage[] = [
    ...messages,
    { role: "assistant", content: first },
    {
      role: "user",
      content:
        "Your previous response failed schema validation with these issues:\n" +
        `${JSON.stringify(firstResult.issues)}\n` +
        "Return ONLY corrected JSON that satisfies the schema. No prose.",
    },
  ];
  const secondCall = await jsonTransport(repairMessages);
  if (secondCall.usage) {
    usage = {
      prompt_tokens: (usage?.prompt_tokens ?? 0) + (secondCall.usage.prompt_tokens ?? 0),
      completion_tokens: (usage?.completion_tokens ?? 0) + (secondCall.usage.completion_tokens ?? 0),
    };
  }
  const second = secondCall.content;
  if (second === null) {
    record("failed", 1);
    throw new LLMValidationError("LLM produced no output on repair retry", {
      rawOutput: first,
      issues: firstResult.issues,
      retryCount: 1,
    });
  }
  const secondResult = attempt(second);
  if (secondResult.ok) {
    record("repaired", 1);
    return { data: secondResult.value, retryCount: 1 };
  }

  record("failed", 1);
  throw new LLMValidationError("LLM output failed schema validation after repair retry", {
    rawOutput: second,
    issues: secondResult.issues,
    retryCount: 1,
  });
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

  const start = Date.now();
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
        temperature: 0.2,
        messages,
        ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`LLM API ${response.status}: ${await response.text()}`);
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
    const message = payload.choices?.[0]?.message;
    return {
      content: message?.content ?? "",
      toolCalls: message?.tool_calls ?? [],
    };
  } catch (error) {
    emitCallRecord({
      modelVersion: provider.model,
      latencyMs: Date.now() - start,
      validationStatus: "failed",
      retryCount: 0,
    });
    throw error;
  }
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

  const start = Date.now();
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
        temperature: 0.2,
        messages: [{ role: "user", content }],
      }),
    });
    if (!response.ok) {
      throw new Error(`LLM API ${response.status}: ${await response.text()}`);
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
  }
}

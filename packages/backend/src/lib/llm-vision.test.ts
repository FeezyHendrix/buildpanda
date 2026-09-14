import { test } from "node:test";
import assert from "node:assert/strict";

// Env must be set before the config module is first imported, hence the
// dynamic import below (each test file runs in its own process).
process.env.DEEPSEEK_API_KEY = "sk-test";
process.env.OPENAI_API_KEY = "sk-openai";
const { chatVision, chatVisionJsonValidated, activeVisionModelName, isVisionConfigured } = await import("./llm-vision.ts");
const { z } = await import("zod");

test("images go to DeepSeek even when a text provider is also configured", async () => {
  assert.equal(isVisionConfigured(), true);
  assert.equal(activeVisionModelName(), "deepseek-flash");

  const calls: Array<{ url: string; body: Record<string, unknown>; auth: string | undefined }> = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string> | undefined;
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)), auth: headers?.Authorization });
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "A ground floor plan." } }], usage: { prompt_tokens: 900, completion_tokens: 12 } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  try {
    const text = await chatVision("Describe this drawing", ["data:image/png;base64,AAAA"], { detail: "high" });
    assert.equal(text, "A ground floor plan.");
    assert.equal(calls.length, 1);
    const call = calls[0]!;
    assert.equal(call.url, "https://api.deepseek.com/chat/completions");
    assert.equal(call.auth, "Bearer sk-test");
    assert.equal(call.body.model, "deepseek-flash");
    const messages = call.body.messages as Array<{ role: string; content: unknown[] }>;
    assert.deepEqual(messages[0]?.content, [
      { type: "text", text: "Describe this drawing" },
      { type: "image_url", image_url: { url: "data:image/png;base64,AAAA", detail: "high" } },
    ]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a non-2xx vision response surfaces as an error, not a silent null", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("rate limited", { status: 429 })) as typeof fetch;
  try {
    await assert.rejects(chatVision("x", ["data:image/png;base64,AAAA"]), /Vision API 429/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("JSON-validated image calls (invoice scan) also go to DeepSeek with an explicit output cap", async () => {
  const bodies: Record<string, unknown>[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    bodies.push({ url: String(url), ...JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ total: 120 }) } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const result = await chatVisionJsonValidated(
      [{ role: "user", content: [{ type: "text", text: "json please" }, { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }] }],
      z.object({ total: z.number() }),
    );
    assert.equal(result?.data.total, 120);
    assert.equal(bodies.length, 1);
    assert.equal(bodies[0]?.url, "https://api.deepseek.com/chat/completions");
    assert.equal(bodies[0]?.model, "deepseek-flash");
    assert.deepEqual(bodies[0]?.response_format, { type: "json_object" });
    assert.equal(bodies[0]?.max_tokens, 32_000);
  } finally {
    globalThis.fetch = realFetch;
  }
});

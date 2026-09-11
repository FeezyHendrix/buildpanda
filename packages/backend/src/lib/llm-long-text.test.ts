import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// Env must be set before config is first imported (each test file is its own process).
process.env.DEEPSEEK_API_KEY = "sk-test";
process.env.OPENAI_API_KEY = "sk-openai";
const { chatLongJsonValidated, longTextCharBudget, longTextProvider } = await import("./llm-long-text.ts");
const { chatJsonValidated, activeModelName } = await import("./llm.ts");

test("long-document calls use DeepSeek's budget while plain JSON calls stay on the text provider", async () => {
  assert.equal(longTextProvider()?.model, "deepseek-flash");
  assert.equal(longTextCharBudget(), 400_000);
  assert.equal(activeModelName(), "gpt-4o-mini");

  const models: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    models.push((JSON.parse(String(init?.body)) as { model: string }).model);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const schema = z.object({ ok: z.boolean() });
    await chatLongJsonValidated([{ role: "user", content: "json" }], schema);
    await chatJsonValidated([{ role: "user", content: "json" }], schema);
    assert.deepEqual(models, ["deepseek-flash", "gpt-4o-mini"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

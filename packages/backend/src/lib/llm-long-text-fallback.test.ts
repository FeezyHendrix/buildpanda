import { test } from "node:test";
import assert from "node:assert/strict";

// No DeepSeek key: long-document calls must behave exactly as before.
delete process.env.DEEPSEEK_API_KEY;
process.env.OPENAI_API_KEY = "sk-openai";
const { longTextCharBudget, longTextProvider, DEFAULT_TEXT_CHARS } = await import("./llm-long-text.ts");

test("without a DeepSeek key the long-text path falls back to the text provider and the 24K budget", () => {
  assert.equal(longTextProvider()?.model, "gpt-4o-mini");
  assert.equal(longTextCharBudget(), DEFAULT_TEXT_CHARS);
  assert.equal(DEFAULT_TEXT_CHARS, 24_000);
});

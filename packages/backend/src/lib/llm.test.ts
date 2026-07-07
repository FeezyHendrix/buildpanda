import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { chatJsonValidated, LLMValidationError, setJsonTransportForTests, type LlmMessage } from "./llm.ts";

const schema = z.object({ answer: z.number() });
const messages: LlmMessage[] = [{ role: "user", content: "q" }];

test("valid JSON resolves to a typed value with retryCount 0", async () => {
  const restore = setJsonTransportForTests(async () => JSON.stringify({ answer: 42 }));
  try {
    const result = await chatJsonValidated(messages, schema);
    assert.ok(result);
    assert.equal(result.data.answer, 42);
    assert.equal(result.retryCount, 0);
  } finally {
    restore();
  }
});

test("schema-violating JSON once then valid resolves after exactly one repair retry", async () => {
  let call = 0;
  const restore = setJsonTransportForTests(async () => {
    call += 1;
    return call === 1 ? JSON.stringify({ answer: "not a number" }) : JSON.stringify({ answer: 7 });
  });
  try {
    const result = await chatJsonValidated(messages, schema);
    assert.ok(result);
    assert.equal(result.data.answer, 7);
    assert.equal(result.retryCount, 1);
    assert.equal(call, 2);
  } finally {
    restore();
  }
});

test("invalid twice throws LLMValidationError carrying the raw output", async () => {
  const restore = setJsonTransportForTests(async () => JSON.stringify({ answer: "still bad" }));
  try {
    await assert.rejects(
      () => chatJsonValidated(messages, schema),
      (error: unknown) => {
        assert.ok(error instanceof LLMValidationError);
        assert.equal(error.statusCode, 502);
        const details = error.details as { rawOutput: string | null; retryCount: number };
        assert.equal(details.retryCount, 1);
        assert.match(details.rawOutput ?? "", /still bad/);
        return true;
      },
    );
  } finally {
    restore();
  }
});

test("non-JSON string is treated as a schema failure and repaired", async () => {
  let call = 0;
  const restore = setJsonTransportForTests(async () => {
    call += 1;
    return call === 1 ? "this is not json" : JSON.stringify({ answer: 1 });
  });
  try {
    const result = await chatJsonValidated(messages, schema);
    assert.ok(result);
    assert.equal(result.data.answer, 1);
    assert.equal(result.retryCount, 1);
  } finally {
    restore();
  }
});

test("null transport output (no provider) resolves to null, not an error", async () => {
  const restore = setJsonTransportForTests(async () => null);
  try {
    const result = await chatJsonValidated(messages, schema);
    assert.equal(result, null);
  } finally {
    restore();
  }
});

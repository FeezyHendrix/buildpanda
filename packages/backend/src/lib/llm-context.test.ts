import { test } from "node:test";
import assert from "node:assert/strict";
import { enterLlmContext, getLlmContext, runWithLlmContext } from "./llm-context.ts";

test("enterLlmContext propagates to later async work in the same chain", async () => {
  await runWithLlmContext({ source: "system" }, async () => {
    enterLlmContext({ orgId: "org_1", source: "request" });
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(getLlmContext()?.orgId, "org_1");
  });
});

test("runWithLlmContext isolates context between concurrent flows", async () => {
  const seen: Array<string | undefined> = [];
  await Promise.all([
    runWithLlmContext({ orgId: "org_a", source: "job" }, async () => {
      await new Promise((r) => setTimeout(r, 10));
      seen.push(getLlmContext()?.orgId);
    }),
    runWithLlmContext({ orgId: "org_b", source: "job" }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      seen.push(getLlmContext()?.orgId);
    }),
  ]);
  assert.deepEqual(seen.sort(), ["org_a", "org_b"]);
});

test("no context outside any run returns undefined", () => {
  assert.equal(getLlmContext(), undefined);
});

test("setImmediate (inline-queue path) preserves context set by runWithLlmContext", async () => {
  const orgId = await runWithLlmContext({ orgId: "org_inline", source: "job" }, () =>
    new Promise<string | undefined>((resolve) => {
      setImmediate(() => resolve(getLlmContext()?.orgId));
    }),
  );
  assert.equal(orgId, "org_inline");
});

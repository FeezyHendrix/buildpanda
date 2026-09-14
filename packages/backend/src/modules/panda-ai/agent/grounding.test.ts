import { test } from "node:test";
import assert from "node:assert/strict";
import { applyGroundingGate, isSubstantiveToolResult } from "./grounding.ts";
import type { LlmMessage } from "../../../lib/llm.ts";

test("isSubstantiveToolResult: real data is substantive", () => {
  assert.equal(isSubstantiveToolResult([{ id: "t1" }]), true);
  assert.equal(isSubstantiveToolResult({ invoices: [{ id: "i1" }] }), true);
  assert.equal(isSubstantiveToolResult({ total: 1500 }), true);
  assert.equal(isSubstantiveToolResult("some text"), true);
});

test("isSubstantiveToolResult: empty / error / null is NOT substantive", () => {
  assert.equal(isSubstantiveToolResult([]), false);
  assert.equal(isSubstantiveToolResult({ error: "not found" }), false);
  assert.equal(isSubstantiveToolResult({ items: [] }), false);
  assert.equal(isSubstantiveToolResult({}), false);
  assert.equal(isSubstantiveToolResult(null), false);
  assert.equal(isSubstantiveToolResult(undefined), false);
  assert.equal(isSubstantiveToolResult(""), false);
});

const base: LlmMessage[] = [
  { role: "system", content: "sys" },
  { role: "user", content: "how many invoices are overdue?" },
];

test("tools called but ALL empty -> refusal directive injected", () => {
  const decision = applyGroundingGate(base, true, false);
  assert.equal(decision.refused, true);
  assert.equal(decision.conversation.length, base.length + 1);
  const injected = decision.conversation.at(-1)!;
  assert.equal(injected.role, "system");
  assert.match(String(injected.content), /NO project data|could not find/i);
});

test("tools called and at least one returned data -> no refusal, conversation unchanged", () => {
  const decision = applyGroundingGate(base, true, true);
  assert.equal(decision.refused, false);
  assert.deepEqual(decision.conversation, base);
});

test("no tools called (e.g. greeting) -> no refusal", () => {
  const decision = applyGroundingGate(base, false, false);
  assert.equal(decision.refused, false);
  assert.deepEqual(decision.conversation, base);
});

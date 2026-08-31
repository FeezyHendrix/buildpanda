import assert from "node:assert/strict";
import { test } from "node:test";
import { setJsonTransportForTests } from "../../../lib/llm.ts";
import { classifyTranscript } from "./service.ts";

test("classifyTranscript maps validated model output to typed actions", async () => {
  const restore = setJsonTransportForTests(async () => ({
    content: JSON.stringify({
      actions: [
        {
          kind: "rfi",
          title: "Rebar spacing query",
          summary: "Raise an RFI about rebar spacing on grid B",
          payload: { subject: "Rebar spacing", question: "What is the rebar spacing on grid B?", priority: "High" },
        },
        {
          kind: "daily_log",
          title: "Slab pour",
          summary: "Log today's level 2 slab pour",
          payload: { bodyText: "Poured the level 2 slab this morning." },
        },
      ],
    }),
  }));

  try {
    const actions = await classifyTranscript("we poured the slab and I need to ask about rebar spacing");
    assert.equal(actions.length, 2);
    const [first, second] = actions;
    assert.ok(first && second);
    assert.equal(first.kind, "rfi");
    assert.equal(second.kind, "daily_log");
    if (first.kind === "rfi") assert.equal(first.payload.priority, "High");
  } finally {
    restore();
  }
});

test("classifyTranscript drops actions missing required fields", async () => {
  const restore = setJsonTransportForTests(async () => ({
    content: JSON.stringify({
      actions: [
        { kind: "material_order", title: "Cement", summary: "Order cement", payload: { title: "Cement", materialName: "Cement" } },
        { kind: "daily_log", title: "Delivery", summary: "Log a delivery", payload: { bodyText: "Ten tonnes of sand arrived." } },
      ],
    }),
  }));

  try {
    const actions = await classifyTranscript("some site note");
    assert.equal(actions.length, 1);
    const [only] = actions;
    assert.ok(only);
    assert.equal(only.kind, "daily_log");
  } finally {
    restore();
  }
});

test("classifyTranscript keeps received materials as a ledger entry", async () => {
  const restore = setJsonTransportForTests(async () => ({
    content: JSON.stringify({
      actions: [
        {
          kind: "material_log",
          title: "Cement received",
          summary: "Log 30 bags of cement received on site",
          payload: { entryType: "IN", materialName: "cement", quantity: 30, unit: "bags" },
        },
      ],
    }),
  }));

  try {
    const actions = await classifyTranscript("received 30 bags of cement");
    assert.equal(actions.length, 1);
    const [only] = actions;
    assert.ok(only);
    assert.equal(only.kind, "material_log");
    if (only.kind === "material_log") assert.equal(only.payload.entryType, "IN");
  } finally {
    restore();
  }
});

test("classifyTranscript short-circuits an empty transcript without calling the model", async () => {
  let called = false;
  const restore = setJsonTransportForTests(async () => {
    called = true;
    return { content: null };
  });

  try {
    assert.deepEqual(await classifyTranscript("   "), []);
    assert.equal(called, false);
  } finally {
    restore();
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { setJsonTransportForTests } from "../../../lib/llm.ts";
import { classifyTranscript } from "./service.ts";
import type { ProjectSnapshot } from "./types.ts";

const SNAPSHOT: ProjectSnapshot = {
  rfis: [{ id: "rfi_1", number: 12, subject: "Rebar spacing", status: "Open" }],
  changeRequests: [{ id: "cr_1", title: "Lobby tiles", status: "Draft" }],
  materialOrders: [
    { id: "mo_1", title: "Cement", materialName: "cement", quantity: 30, unit: "bags", status: "Requested" },
  ],
  lookAheads: [{ id: "la_1", name: "Week 40", startDate: "2026-09-28", endDate: "2026-10-04", status: "Draft" }],
};

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

test("classifyTranscript accepts updates that target a snapshot record", async () => {
  const restore = setJsonTransportForTests(async () => ({
    content: JSON.stringify({
      actions: [
        {
          kind: "update_material_order",
          title: "Cement order to 50 bags",
          summary: "Change the cement order quantity to 50 bags",
          payload: { orderId: "mo_1", patch: { quantity: 50 } },
        },
        {
          kind: "transition_rfi",
          title: "Close RFI-12",
          summary: "Close the rebar spacing RFI",
          payload: { rfiId: "rfi_1", status: "Closed" },
        },
      ],
    }),
  }));

  try {
    const actions = await classifyTranscript("change the cement order to 50 bags and close RFI 12", SNAPSHOT);
    assert.equal(actions.length, 2);
    const [first, second] = actions;
    assert.ok(first && second);
    assert.equal(first.kind, "update_material_order");
    assert.equal(second.kind, "transition_rfi");
  } finally {
    restore();
  }
});

test("classifyTranscript drops updates whose target id is not in the snapshot", async () => {
  const restore = setJsonTransportForTests(async () => ({
    content: JSON.stringify({
      actions: [
        {
          kind: "delete_look_ahead",
          title: "Remove week 41 plan",
          summary: "Delete a look ahead that does not exist",
          payload: { lookAheadId: "la_hallucinated" },
        },
        {
          kind: "update_daily_log",
          title: "Set hours to 8",
          summary: "Update today's total hours to 8",
          payload: { totalHours: 8 },
        },
      ],
    }),
  }));

  try {
    const actions = await classifyTranscript("delete the week 41 plan and set hours to eight", SNAPSHOT);
    assert.equal(actions.length, 1);
    const [only] = actions;
    assert.ok(only);
    assert.equal(only.kind, "update_daily_log");
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

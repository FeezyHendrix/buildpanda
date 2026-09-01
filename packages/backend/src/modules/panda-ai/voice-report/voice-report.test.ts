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
  activities: [{ id: "act_1", name: "Blockwork", status: "InProgress" }],
  delayReasons: [{ code: "WEATHER", name: "Weather" }],
  ledgerEntries: [{ id: "mle_1", entryType: "IN", materialName: "cement", quantity: 30, unit: "bags" }],
  todayEntries: [{ id: "dle_1", logDate: "2026-08-31", authorName: "Adura", snippet: "Poured the slab" }],
  stages: [
    { id: "stg_1", name: "Site Survey & Soil Testing", status: "InProgress", buildingId: "bld_1" },
    { id: "stg_2", name: "Permitting & Approvals", status: "Pending", buildingId: "bld_1" },
  ],
  buildings: [{ id: "bld_1", name: "Block A", code: "A" }],
  today: "2026-09-01",
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

test("an under-specified look ahead survives as an action with fields to fill", async () => {
  const restore = setJsonTransportForTests(async () => ({
    content: JSON.stringify({
      actions: [
        {
          kind: "look_ahead",
          title: "Site excavation",
          summary: "Plan site excavation for tomorrow",
          payload: { name: "Site excavation", startDate: null, endDate: null },
        },
      ],
    }),
  }));

  try {
    const actions = await classifyTranscript("look ahead for tomorrow, site excavation", SNAPSHOT);
    assert.equal(actions.length, 1, "the action must survive rather than degrade into a daily log");
    const [action] = actions;
    assert.ok(action);
    assert.equal(action.kind, "look_ahead");
    assert.deepEqual(
      action.missing.map((f) => f.name).sort(),
      ["endDate", "startDate"],
      "both unstated dates are offered to the reviewer",
    );
  } finally {
    restore();
  }
});

test("a stage transition resolves a real stage and offers the status picker", async () => {
  const restore = setJsonTransportForTests(async () => ({
    content: JSON.stringify({
      actions: [
        {
          kind: "transition_stage",
          title: "Complete site survey",
          summary: "Mark Site Survey & Soil Testing as done",
          payload: { stageId: "stg_1", status: "Done" },
        },
        {
          kind: "transition_stage",
          title: "Start permitting",
          summary: "Mark Permitting & Approvals as started",
          payload: { stageId: "stg_nope", status: null },
        },
      ],
    }),
  }));

  try {
    const actions = await classifyTranscript("we finished the site survey, start permitting", SNAPSHOT);
    assert.equal(actions.length, 2);
    const [done, invented] = actions;
    assert.ok(done && invented);
    if (done.kind === "transition_stage") {
      assert.equal(done.payload.stageId, "stg_1");
      assert.deepEqual(done.missing, [], "a fully stated transition needs nothing from the reviewer");
    }
    if (invented.kind === "transition_stage") {
      assert.equal(invented.payload.stageId, null, "an invented stage id is cleared, not trusted");
      const names = invented.missing.map((f) => f.name).sort();
      assert.deepEqual(names, ["stageId", "status"]);
      const stagePicker = invented.missing.find((f) => f.name === "stageId");
      assert.equal(stagePicker?.type, "select");
      assert.equal(stagePicker?.options?.length, 2, "the picker offers the project's real stages");
    }
  } finally {
    restore();
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestError } from "../../lib/errors.ts";
import { draftDailyActions, normalizeReview, reviewCommand } from "./draft.ts";
import type { MessagingReviewAction } from "./management-types.ts";
import { MessagingClarificationError } from "./draft-errors.ts";
import { sanitizeRichText } from "../../lib/rich-text.ts";

const scope = { projectId: "site", organizationId: "company", buildingId: "block-a", projectName: "Main Site", buildingName: "Block A" };
const target = { buildingId: scope.buildingId, logDate: "2026-11-14" };
const note = (bodyText: string) => ({ kind: "daily_log", payload: { ...target, bodyText } });

test("text and translated voice preserve paragraphs and source wording while generating safe rich text", async () => {
  const source = "  Nine workers\n\nSlab poured — 12m³ <ready>.  ";
  const result = await draftDailyActions(source, scope, [], async (messages) => {
    assert.equal(messages[1]!.content, source);
    assert.match(String(messages[0]!.content), /Main Site/);
    assert.match(String(messages[0]!.content), /Block A/);
    return { actions: [note(source)], unresolved: [] };
  });
  assert.equal(result[0]!.payload.bodyText, source);
  assert.match(String(result[0]!.payload.bodyHtml), /&lt;ready&gt;/);
  assert.match(String(result[0]!.payload.bodyHtml), /<br \/><br \/>/);
  assert.equal(result[0]!.payload.logDate, target.logDate);
});

test("generated headers preserve null, zero, canonical quantities and the summary text/HTML mirror", async () => {
  const header = { ...target, weatherCondition: "Rain", temperatureC: null, precipitationMm: 0, windKph: 0,
    workersExpected: 10, workersPresent: 0, totalHours: 7.5, summary: "First paragraph\n\n<Second> paragraph" };
  const [result] = await draftDailyActions("Update the day", scope, [], async () => ({ actions: [{ kind: "update_daily_log", payload: header }], unresolved: [] }));
  assert.equal(result!.payload.summary, header.summary);
  assert.equal(result!.payload.summaryHtml, "<p>First paragraph<br /><br />&lt;Second&gt; paragraph</p>");
  assert.equal(result!.payload.workersPresent, 0); assert.equal(result!.payload.windKph, 0);
  assert.equal(result!.payload.temperatureC, null);
  const [clear] = await draftDailyActions("Clear summary", scope, [], async () => ({ actions: [{ kind: "update_daily_log", payload: { ...target, summary: null } }], unresolved: [] }));
  assert.equal(clear!.payload.summary, null); assert.equal(clear!.payload.summaryHtml, null);
});

test("a simple correction receives the existing full batch and remains editable", async () => {
  const previous = normalizeReview([note("Eight workers\nSlab poured"), { kind: "update_daily_log", payload: { ...target, workersPresent: 8 } }], scope);
  const before = structuredClone(previous);
  const result = await draftDailyActions("Actually nine workers", scope, previous, async (messages) => {
    assert.match(String(messages[0]!.content), /Eight workers/);
    return { actions: [note("Nine workers\nSlab poured"), { kind: "update_daily_log", payload: { ...target, workersPresent: 9 } }], unresolved: [] };
  });
  assert.equal(result.length, 2); assert.equal(result[1]!.payload.workersPresent, 9);
  assert.deepEqual(previous, before);
});

test("empty and oversized sources fail before model invocation", async () => {
  for (const source of ["", " \n ", "x".repeat(20_001), null]) {
    await assert.rejects(draftDailyActions(source as string, scope, [], async () => { throw new Error("Must not call model"); }), BadRequestError);
  }
});

test("malformed, invalid and out-of-scope generated actions fail closed", async () => {
  for (const result of [null, {}, [], { actions: [note("Work")] },
    { actions: [], unresolved: [] }, { actions: Array.from({ length: 11 }, () => note("Work")), unresolved: [] },
    { actions: [{ kind: "create_task", payload: { ...target, title: "Work" } }], unresolved: [] },
    { actions: [{ ...note("Work"), payload: { ...target, buildingId: "foreign", bodyText: "Work" } }], unresolved: [] },
    { actions: [{ ...note("Work"), payload: { ...target, logDate: "2026-02-30", bodyText: "Work" } }], unresolved: [] },
    { actions: [{ kind: "update_daily_log", payload: { ...target, workersPresent: 5001 } }], unresolved: [] },
  ]) await assert.rejects(draftDailyActions("Save work", scope, [], async () => result), (error: unknown) => error instanceof BadRequestError || error instanceof MessagingClarificationError);
});

test("ordinary notes tolerate only harmless canonical null placeholders", async () => {
  for (const placeholders of [{ bodyHtml: null }, { templateId: null }, { responses: null }]) {
    const [result] = await draftDailyActions("Work completed", scope, [], async () => ({ actions: [{ kind: "daily_log", payload: { ...target, bodyText: "Work completed", ...placeholders } }], unresolved: [] }));
    assert.equal(result!.payload.bodyText, "Work completed"); assert.equal(result!.payload.bodyHtml, "<p>Work completed</p>");
  }
  const [header] = await draftDailyActions("Clear summary", scope, [], async () => ({ actions: [{ kind: "update_daily_log", payload: { ...target, summary: null, summaryHtml: null } }], unresolved: [] }));
  assert.equal(header!.payload.summary, null); assert.equal(header!.payload.summaryHtml, null);
  await assert.rejects(draftDailyActions("Work", scope, [], async () => ({ actions: [{ kind: "daily_log", payload: { ...target, bodyText: "Work", projectId: null } }], unresolved: [] })), BadRequestError);
});

test("tanker and sand ambiguity become specific clarification questions", async () => {
  const question = "What did the tanker carry, and what quantity and unit were delivered?";
  await assert.rejects(draftDailyActions("We just received a tanker that was supposed to come last week", scope, [], async (messages) => {
    const prompt = String(messages[0]!.content);
    assert.match(prompt, /A tanker is a vehicle/); assert.match(prompt, /expected is not the actual/);
    return { actions: [], unresolved: [question] };
  }), (error: unknown) => {
    assert.ok(error instanceof MessagingClarificationError); assert.equal(error.code, "messaging_clarification_needed"); assert.equal(error.message, question); return true;
  });
  await assert.rejects(draftDailyActions("And some sands came in too", scope, [], async () => ({ actions: [{ kind: "material_log", payload: { entryType: "IN", materialName: "Sand", quantity: null, unit: null } }], unresolved: [] })), (error: unknown) => {
    assert.ok(error instanceof MessagingClarificationError); assert.match(error.message, /quantity/); assert.match(error.message, /unit/); return true;
  });
});

test("clarification history keeps separate deliveries and never substitutes the expected date", async () => {
  const recentMessages = [
    { role: "user" as const, content: "We just received a tanker that was supposed to come last week" },
    { role: "assistant" as const, content: "What did the tanker carry, and how much arrived?" },
    { role: "user" as const, content: "And some sands came in too" },
    { role: "assistant" as const, content: "What quantity and unit of sand arrived?" },
  ];
  const [tanker, sand] = await draftDailyActions("5,000 litres of diesel and 12 m³ of sand", { ...scope, buildingId: null, recentMessages }, [], async (messages) => {
    assert.deepEqual(messages.slice(1, -1), recentMessages); assert.equal(messages.at(-1)!.content, "5,000 litres of diesel and 12 m³ of sand");
    return { actions: [
      { kind: "material_log", payload: { entryType: "IN", materialName: "Diesel", quantity: 5000, unit: "litres", reason: "Was supposed to arrive last week", notesHtml: null } },
      { kind: "material_log", payload: { entryType: "IN", materialName: "Sand", quantity: 12, unit: "m³" } },
    ], unresolved: [] };
  });
  assert.equal(tanker!.kind, "material_log"); assert.equal(tanker!.payload.quantity, 5000); assert.equal(tanker!.payload.occurredAt, undefined);
  assert.equal(tanker!.payload.buildingId, undefined); assert.equal(sand!.payload.materialName, "Sand"); assert.equal(sand!.payload.quantity, 12);
});

test("material usage remains a material action and missing named-order targets are clarified", async () => {
  const [used] = await draftDailyActions("Used two tonnes of sand", scope, [], async () => ({ actions: [{ kind: "material_log", payload: { entryType: "USED", materialName: "Sand", quantity: 2, unit: "tonnes" } }], unresolved: [] }));
  assert.equal(used!.kind, "material_log"); assert.equal(used!.payload.entryType, "USED");
  await assert.rejects(draftDailyActions("Received the order named Cement November", scope, [], async () => ({ actions: [], unresolved: ["Which authorized Cement November order should I receive?"] })), MessagingClarificationError);
  await assert.rejects(draftDailyActions("Log site progress", { ...scope, buildingId: null }, [], async () => ({ actions: [note("Progress")], unresolved: [] })), MessagingClarificationError);
});

test("the model cannot invent mismatched rich content, template answers, attachments, or record IDs", async () => {
  for (const payload of [
    { ...target, bodyText: "Work", bodyHtml: "<p>Invented</p>" },
    { ...target, bodyText: "Work", templateId: "guessed" },
    { ...target, bodyText: "Work", responses: { safe: true } },
    { ...target, bodyText: "![Evidence](/files/guessed/download)" },
    { ...target, bodyText: "Work", projectId: "foreign" },
  ]) await assert.rejects(draftDailyActions("Save work", scope, [], async () => ({ actions: [{ kind: "daily_log", payload }], unresolved: [] })), (error: unknown) => error instanceof BadRequestError || error instanceof MessagingClarificationError);
  await assert.rejects(draftDailyActions("Update header", scope, [], async () => ({ actions: [{ kind: "update_daily_log", payload: { ...target, summaryHtml: "<p>Invented</p>" } }], unresolved: [] })), BadRequestError);
});

test("canonical review blocks empty notes and empty header updates while preserving rich fields and explicit clears", () => {
  for (const action of [note(" \n "), { kind: "daily_log", payload: { ...target, bodyHtml: "<p>&nbsp;</p>" } },
    { kind: "daily_log", payload: { ...target, bodyHtml: "<script>bad()</script>" } },
    { kind: "update_daily_log", payload: { ...target } },
  ]) assert.throws(() => normalizeReview([action], scope), BadRequestError);
  const [rich] = normalizeReview([{ kind: "daily_log", payload: { ...target, bodyHtml: '<p onclick="bad()">Safe <strong>text</strong></p>', bodyText: "Safe text" } }], scope);
  assert.equal(rich!.payload.bodyHtml, "<p>Safe <strong>text</strong></p>");
  assert.equal(rich!.payload.bodyText, "Safe text");
  const [clear] = normalizeReview([{ kind: "update_daily_log", payload: { ...target, summary: null, temperatureC: null, totalHours: 0 } }], scope);
  assert.equal(reviewCommand(clear!, scope).payload.buildingId, scope.buildingId);
  assert.equal(clear!.payload.summary, null); assert.equal(clear!.payload.totalHours, 0);
});

test("model corrections retain previously reviewed templates, files and rich content", async () => {
  const complex: MessagingReviewAction[] = [
    { kind: "daily_log", title: "Template", payload: { ...target, templateId: "diary", responses: { safe: false } } },
    { kind: "daily_log", title: "File", payload: { ...target, bodyText: "Photo", bodyHtml: '<p>Photo</p><img data-file-id="photo" src="/files/photo/download">' } },
    { kind: "daily_log", title: "Rich", payload: { ...target, bodyText: "Safe text", bodyHtml: "<p>Safe <strong>text</strong></p>" } },
    { kind: "update_daily_log", title: "Rich summary", payload: { ...target, summary: "Safe text", summaryHtml: "<p>Safe <strong>text</strong></p>" } },
    { kind: "material_log", title: "Rich material notes", payload: { entryType: "IN", materialName: "Sand", quantity: 12, unit: "m³", reason: "Safe text", notesHtml: "<p>Safe <strong>text</strong></p>" } },
  ];
  for (const previous of complex) {
    const [result] = await draftDailyActions("Keep the same details", scope, [previous], async () => ({ actions: [{ kind: previous.kind, payload: {} }], unresolved: [] }));
    for (const [key, value] of Object.entries(previous.payload)) assert.deepEqual(result!.payload[key], key.endsWith("Html") && typeof value === "string" ? sanitizeRichText(value) : value, key);
  }
});

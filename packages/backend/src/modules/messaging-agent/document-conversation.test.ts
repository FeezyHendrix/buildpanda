import assert from "node:assert/strict";
import { test } from "node:test";
import { draftDailyActions } from "./draft.ts";
import { attachmentEvidence } from "./document-review.ts";
import { messagingAgentReviewService } from "./review-service.ts";
import { fixture as workerFixture } from "./test-fixture.ts";
import type { DocumentAnalysis, DocumentInspection } from "./document-analysis.ts";

async function fixture(run: Parameters<typeof workerFixture>[0]) {
  return workerFixture(async (f) => {
    const settings = await f.db("platform_settings").where({ id: "singleton" }).first("feature_flags");
    try { await run(f); }
    finally {
      if (settings) await f.db("platform_settings").where({ id: "singleton" }).update({ feature_flags: settings.feature_flags });
      else await f.db("platform_settings").where({ id: "singleton" }).delete();
    }
  });
}
const url = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
const analysis: DocumentAnalysis = { kind: "receipt", confidence: "high", title: "Transfer", summary: "NGN85000 transfer", purpose: null,
  vendor: "ABC", reference: "TX-1", date: "2026-11-24", currency: "NGN", amount: 85000, direction: "unknown", revision: null, drawingNumber: null, items: [], uncertainties: ["Purpose unclear"] };
const inspection: DocumentInspection = { status: "read", analysis, pagesRead: 1, pageCount: 1, complete: true, notice: null };

test("forwarded receipt, spoken purpose and confirmed review save one expense with original evidence", { skip: !url }, async () => fixture(async (f) => {
  await f.db("platform_settings").insert({ id: "singleton", feature_flags: JSON.stringify({ "commercial.transactions": true, "quality.dailyLogs": true }) }).onConflict("id").merge();
  await f.db("project_participants").where({ user_id: f.userId }).update({ grants: JSON.stringify({ project: ["view"], finances: ["manage", "viewCosts"], dailyLog: ["view", "create"], buildings: ["view"] }) });
  const linked = await f.link(), fileId = f.id("receipt");
  await f.db("uploaded_files").insert({ id: fileId, owner_id: f.userId, project_id: f.scope.projectId, file_name: "transfer.pdf", mime_type: "application/pdf", size_bytes: 20, storage_path: "fixture/receipt" });
  const original = await f.receive(null, { type: "attachment", sourceFileId: fileId, mediaMimeType: "application/pdf" });
  await f.repo.setInboxContent(original.id, { sourceFileId: fileId, sourceKind: "file_attachment" });
  await f.db("messaging_agent_inbox").where({ id: original.id }).update({ attachment_analysis: JSON.stringify(inspection) });
  let modelCalls = 0;
  const worker = f.worker({ translate: async () => "I paid ABC 85000 naira for cement for Block A on November 24.",
    draft: (text, scope, previous) => draftDailyActions(text, scope, previous, async () => {
      modelCalls++;
      assert.equal((scope.targets?.attachments as { id: string }[])[0]!.id, fileId);
      if (modelCalls === 1) return { actions: [], unresolved: [], reads: [{ name: "list_transactions", args: {} }], answer: null };
      return { actions: [{ kind: "create_expense", payload: { title: "Cement for Block A", amount: 85000, currency: "NGN", category: "materials", vendor: "ABC", reference: "TX-1", transactedAt: "2026-11-24", receiptFileId: fileId } }], unresolved: [], reads: [], answer: null };
    }),
  });
  await worker.processInbox(original.id);
  assert.equal(modelCalls, 0);
  const question = await f.reply(original.id); assert.match(question.body, /payment for.*paid or received/);
  const voice = await f.receive(null, { type: "audio", mediaId: "voice", mediaMimeType: "audio/ogg" });
  await worker.processInbox(voice.id);
  const review = await f.reply(voice.id); assert.match(review.body, /Cement for Block A/); assert.equal(modelCalls, 2);
  assert.equal(Number((await f.db("project_transactions").where({ project_id: f.scope.projectId }).count("*").first())!.count), 0);
  const confirmation = review.buttons[0].command;
  await worker.processInbox((await f.receive(confirmation)).id);
  await worker.processInbox((await f.receive(confirmation)).id);
  const expenses = await f.db("project_transactions").where({ project_id: f.scope.projectId });
  assert.equal(expenses.length, 1); assert.equal(expenses[0].receipt_file_id, fileId); assert.equal(expenses[0].created_by_id, f.userId);
  // The original clarification must not disclose a now-protected expense file after revocation.
  await f.db("project_participants").where({ user_id: f.userId }).update({ grants: JSON.stringify({ project: ["view"], dailyLog: ["view", "create"], buildings: ["view"] }) });
  const proposal = await f.db("messaging_agent_proposals").where({ inbox_id: original.id }).first();
  const { messagingAgentAccess } = await import("./access.ts");
  const redacted = await messagingAgentReviewService(f.db).dto(proposal, await messagingAgentAccess(f.db).project(f.userId, f.scope.projectId));
  assert.equal(redacted.sourceText, ""); assert.equal(redacted.clarification, null); assert.equal(redacted.summary.includes("85000"), false);
  assert.equal((await f.repo.conversation(linked.identity.id))!.project_id, f.scope.projectId);
}));

test("partial document evidence blocks direct review edits and confirmation", { skip: !url }, async () => fixture(async (f) => {
  await f.db("platform_settings").insert({ id: "singleton", feature_flags: JSON.stringify({ "commercial.transactions": true }) }).onConflict("id").merge();
  await f.db("project_participants").where({ user_id: f.userId }).update({ grants: JSON.stringify({ project: ["view"], finances: ["manage", "viewCosts"], buildings: ["view"] }) });
  const linked = await f.link(), fileId = f.id("long-receipt");
  await f.db("uploaded_files").insert({ id: fileId, owner_id: f.userId, project_id: f.scope.projectId, file_name: "long.pdf", mime_type: "application/pdf", size_bytes: 20, storage_path: "fixture/long" });
  const source = await f.receive("Record cement expense", { type: "attachment", sourceFileId: fileId });
  await f.repo.setInboxContent(source.id, { sourceFileId: fileId, sourceKind: "file_attachment" });
  await f.db("messaging_agent_inbox").where({ id: source.id }).update({ attachment_analysis: JSON.stringify({ ...inspection, complete: false, pagesRead: 6, pageCount: 12 }) });
  const action = { kind: "create_expense", title: "Cement", payload: { title: "Cement", category: "materials", amount: 85000, currency: "NGN", transactedAt: "2026-11-24", receiptFileId: fileId } };
  const proposal = await f.repo.createProposal({ conversationId: linked.conversation.id, inboxId: source.id, scopeVersion: linked.conversation.scope_version,
    actions: [action], sourceText: "Record expense", sourceKind: "file_attachment", sourceFileId: fileId, clarification: null });
  const review = messagingAgentReviewService(f.db);
  await assert.rejects(review.edit(f.userId, f.scope.projectId, proposal.id, proposal.version, [action]), /partly read/);
  const result = await review.confirm(f.userId, f.scope.projectId, proposal.id, proposal.version);
  assert.match(result.clarification!, /partly read/);
  assert.equal(Number((await f.db("project_transactions").where({ project_id: f.scope.projectId }).count("*").first())!.count), 0);
}));

test("read attachment facts are restated beside the sender text; unread files add nothing", () => {
  const file = { id: "file_1", fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 10 };
  const evidence = attachmentEvidence([{ ...file, inspection }])!;
  assert.match(evidence, /"fileId":"file_1"/);
  assert.match(evidence, /"amount":85000/);
  assert.match(evidence, /Never ask the sender for a non-null amount/);
  assert.equal(attachmentEvidence([{ ...file, inspection: { ...inspection, status: "unavailable", analysis: null } }]), null);
});

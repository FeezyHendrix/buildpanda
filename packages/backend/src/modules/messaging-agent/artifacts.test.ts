import assert from "node:assert/strict";
import { test } from "node:test";
import { messagingDocumentArtifacts } from "./artifacts.ts";
import { proposalDto, proposalReceipt } from "./mappers.ts";
import type { MessagingActionRow, MessagingProposalRow } from "./types.ts";

const createdAt = "2026-11-16T10:00:00.000Z";
const action: MessagingActionRow = { id: "action", proposal_id: "review", proposal_version: 1, position: 0, kind: "download_document", title: "Download drawing", summary: null,
  payload: { documentId: "drawing" }, status: "committed", last_error: null, created_at: createdAt, updated_at: createdAt,
  result: { kind: "download_document", projectId: "site", recordId: "drawing", message: "Document revision is ready to view or download in BuildPanda.", data: { documentId: "drawing", versionId: "revision-2", fileName: "Plan A.pdf", mimeType: "application/pdf", url: "/api/do-not-trust-this-path", requiresAuthentication: true } } };
const proposal: MessagingProposalRow = { id: "review", conversation_id: "conversation", inbox_id: "source", organization_id: "company", project_id: "site", building_id: null,
  scope_version: 1, version: 1, status: "completed", source_text: "Download plan A revision 2", clarification: null, source_kind: "text", source_file_id: null, confirmed_at: createdAt, created_at: createdAt, updated_at: createdAt };

test("successful document reads retain a usable authenticated revision link in app and channel receipts", () => {
  const [artifact] = messagingDocumentArtifacts([action]); assert.ok(artifact);
  assert.equal(artifact.apiPath, "/projects/site/documents/drawing/versions/revision-2/view");
  assert.equal(artifact.download, true); assert.equal(new URL(artifact.url).searchParams.has("token"), false);
  assert.equal(artifact.url.includes("do-not-trust-this-path"), false);
  assert.deepEqual(proposalDto(proposal, [action]).artifacts, [artifact]);
  assert.match(proposalReceipt(proposal, [action]), /Completed 1 field action/);
  assert.ok(proposalReceipt(proposal, [action]).includes(artifact.url));
  assert.match(proposalReceipt(proposal, [action]), /sign-in required/);
});

test("proposed, failed, unrelated and malformed results cannot expose an artifact or extra result data", () => {
  for (const candidate of [{ ...action, status: "proposed" as const }, { ...action, status: "failed" as const }, { ...action, kind: "material_log" }, { ...action, result: { ...action.result, recordId: "another-document" } }]) assert.deepEqual(messagingDocumentArtifacts([candidate]), []);
  const result = proposalDto(proposal, [{ ...action, kind: "material_log", result: { recordId: "receipt", projectId: "site", data: { onHandQty: 999, supplierPrivateNotes: "Hidden" } } }]);
  assert.equal(JSON.stringify(result).includes("supplierPrivateNotes"), false);
  assert.equal(JSON.stringify(result).includes("onHandQty"), false);
});

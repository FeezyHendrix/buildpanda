import assert from "node:assert/strict";
import { test } from "node:test";
import {
  connectionReceipt, MESSAGING_HELP, proposalButtons, proposalDto, proposalMessage, proposalReceipt,
} from "./mappers.ts";
import type { MessagingActionRow, MessagingProposalRow } from "./types.ts";

const timestamp = "2026-11-16T10:00:00.000Z";
const proposal: MessagingProposalRow = {
  clarification: null, id: "maproposal_review-123", conversation_id: "conversation-a", inbox_id: "inbox-a",
  organization_id: "organization-a", project_id: "project-a", building_id: "building-a",
  scope_version: 1, version: 7, status: "draft", source_text: "Original site update",
  source_kind: "text", source_file_id: null, confirmed_at: null, created_at: timestamp, updated_at: timestamp,
};
function action(kind: string, title: string, payload: Record<string, unknown>, position = 0): MessagingActionRow {
  return {
    id: `action-${position}`, proposal_id: proposal.id, proposal_version: proposal.version, position,
    kind, title, summary: null, payload: { buildingId: proposal.building_id, logDate: "2026-11-16", ...payload },
    status: "proposed", result: null, last_error: null, created_at: timestamp, updated_at: timestamp,
  };
}

test("review sections preserve paragraphs, dates, quantities and separate every header field", () => {
  const source = "Nine workers placed 12m³.\n\nSlab <ready> & dimensions 2×3m; *keep wording*.";
  const actions = [
    action("daily_log", "Add daily site note", { bodyText: source }),
    action("update_daily_log", "Update daily log", {
      logDate: "2026-11-15", workersPresent: 0, temperatureC: null, totalHours: 7.5,
      summary: "First paragraph\n\nSecond paragraph",
    }, 1),
  ];
  const before = structuredClone(actions);
  const receipt = proposalReceipt(proposal, actions);
  assert.ok(receipt.startsWith(`Review before saving\nReference: ${proposal.id} · version 7\n\n`));
  assert.ok(receipt.includes(`1. Add daily site note\nDate: 2026-11-16\n\n${source}\n\n2. Update daily log\nDate: 2026-11-15\n\n`));
  assert.ok(receipt.includes("Workers present: 0\nTemperature (°C): clear\nTotal hours: 7.5\nSummary: First paragraph\n\nSecond paragraph"));
  assert.ok(receipt.endsWith("\n\nUse Confirm or Cancel below.\nTo change the details, send a correction."));
  assert.deepEqual(actions, before);
});

test("the app DTO retains its compact semicolon summary and original source", () => {
  const header = action("update_daily_log", "Update daily log", { workersPresent: 0, temperatureC: null, totalHours: 7.5 });
  const result = proposalDto(proposal, [header]);
  assert.equal(result.summary, "2026-11-16: Workers present: 0; Temperature (°C): clear; Total hours: 7.5");
  assert.equal(result.sourceText, proposal.source_text);
  assert.equal(result.actions[0]!.payload, header.payload);
});

test("saved and cancelled receipts have clear sections without confirmation instructions or buttons", () => {
  const actions = [action("daily_log", "Add daily site note", { bodyText: "Slab poured." })];
  const completed = { ...proposal, status: "completed" as const };
  assert.equal(proposalReceipt(completed, actions), `Saved 1 daily-log action.\n\nReference: ${proposal.id}`);
  assert.match(proposalReceipt(completed, [...actions, actions[0]!]), /^Saved 2 daily-log actions\./);
  const cancelled = { ...proposal, status: "cancelled" as const };
  assert.equal(proposalReceipt(cancelled, actions), "Review cancelled.\n\nNo new records were saved.");
  for (const terminal of [completed, cancelled]) {
    assert.doesNotMatch(proposalReceipt(terminal, actions), /Use Confirm|CONFIRM |CANCEL |send a correction/);
    assert.equal(proposalButtons(terminal), undefined);
  }
});

test("only a draft offers Confirm and Cancel for its exact proposal and version", () => {
  assert.deepEqual(proposalButtons(proposal), [
    { label: "Confirm", command: `CONFIRM ${proposal.id} 7` },
    { label: "Cancel", command: `CANCEL ${proposal.id} 7` },
  ]);
  assert.equal(proposalButtons({ ...proposal, status: "confirmed" }), undefined);
  assert.deepEqual(proposalButtons({ ...proposal, id: "different-review", version: 8 }), [
    { label: "Confirm", command: "CONFIRM different-review 8" },
    { label: "Cancel", command: "CANCEL different-review 8" },
  ]);
});

test("full messages group project scope, optional voice attribution and the review separately", () => {
  const actions = [action("daily_log", "Add daily site note", { bodyText: "12m³ poured.\n\nCuring started." })];
  const context = { projectName: "Authorized project", buildingName: "Selected building", voiceNote: false };
  const scope = "Project: Authorized project\nBuilding: Selected building";
  const receipt = proposalReceipt(proposal, actions);
  assert.equal(proposalMessage(proposal, actions, context), `${scope}\n\n${receipt}`);
  assert.equal(proposalMessage(proposal, actions, { ...context, voiceNote: true }), `${scope}\n\nVoice note translated to English for review.\n\n${receipt}`);
});

test("help and connection replies separate guidance, selected scope and opt-out instructions", () => {
  assert.ok(MESSAGING_HELP.startsWith("Panda Agent\n\nUse Field Tools"));
  assert.match(MESSAGING_HELP, /\n\nHow it works\n1\.[^\n]+\n2\.[^\n]+\n3\./);
  assert.match(MESSAGING_HELP, /\n\nTap Confirm to save or Cancel to discard/);
  assert.match(MESSAGING_HELP, /\n\nReply STOP to opt out\./);
  assert.match(MESSAGING_HELP, /current access allows/);
  assert.match(MESSAGING_HELP, /documents and drawings/);
  const connected = connectionReceipt("Site <A> & B", "Block 2");
  assert.ok(connected.startsWith("Connected to Panda.\n\nProject: Site <A> & B\nBuilding: Block 2\n\n"));
  assert.match(connected, /\n\nTap Confirm or Cancel on the review\./);
  assert.ok(connected.endsWith("\n\nReply STOP to opt out."));
});

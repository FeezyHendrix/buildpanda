import assert from "node:assert/strict";
import { test } from "node:test";
import { generateId } from "../../lib/ids.ts";
import { isReviewCommand, parseReviewButtonCommand, validReviewButtons } from "./reply-buttons.ts";

const confirm = { label: "Confirm", command: "CONFIRM maproposal_review-123 7" };
const cancel = { label: "Cancel", command: "CANCEL maproposal_review-123 7" };

test("review button commands preserve exact action, proposal and version", () => {
  assert.deepEqual(parseReviewButtonCommand(confirm.command), { action: "CONFIRM", proposalId: "maproposal_review-123", version: 7 });
  assert.deepEqual(parseReviewButtonCommand(cancel.command), { action: "CANCEL", proposalId: "maproposal_review-123", version: 7 });
  assert.equal(isReviewCommand(confirm.command), true);
  assert.equal(validReviewButtons([confirm, cancel]), true);
});

test("only the paired Confirm and Cancel labels for one proposal revision are accepted", () => {
  for (const value of [
    null, undefined, false, "buttons", {}, [], [confirm], [confirm, cancel, cancel],
    [null, cancel], [confirm, 7], ["Confirm", "Cancel"],
    [cancel, confirm],
    [{ ...confirm, label: "Save" }, cancel],
    [confirm, { ...cancel, label: "Cancel all" }],
    [{ ...confirm, command: cancel.command }, cancel],
    [confirm, { ...cancel, command: confirm.command }],
    [confirm, { ...cancel, command: "CANCEL other-proposal 7" }],
    [confirm, { ...cancel, command: "CANCEL maproposal_review-123 8" }],
    [confirm, { ...cancel, command: "CANCEL maproposal_review-123 07" }],
    [confirm, { ...cancel, command: "STOP" }],
  ]) assert.equal(validReviewButtons(value), false);
});

test("malformed commands and oversized UTF-8 payloads are rejected without coercion", () => {
  const multibyte = `CONFIRM ${"é".repeat(32)} 1`;
  assert.ok(Buffer.byteLength(multibyte, "utf8") > 64);
  for (const value of [
    null, undefined, true, 7, {}, [], new String(confirm.command), "", "STOP", "confirm review 7",
    "CONFIRM review 0", "CONFIRM review -1", "CONFIRM review 01", "CONFIRM review 1.5",
    "CONFIRM review 1000000", "CONFIRM review 1 extra", "CONFIRM  review 7", "CONFIRM review\t7",
    " CONFIRM review 7", "CONFIRM review 7 ", "CONFIRM review 7\n", "CONFIRM ../review 7",
    `CONFIRM ${"a".repeat(49)} 1`, `CONFIRM ${"a".repeat(1000)} 1`, multibyte,
  ]) {
    assert.equal(parseReviewButtonCommand(value), null);
    assert.equal(isReviewCommand(value), false);
  }
});

test("a real generated proposal UUID at the largest supported version fits callback byte limits", () => {
  const id = generateId("maproposal");
  const version = 999999;
  const buttons = [
    { label: "Confirm", command: `CONFIRM ${id} ${version}` },
    { label: "Cancel", command: `CANCEL ${id} ${version}` },
  ];
  for (const button of buttons) {
    assert.ok(Buffer.byteLength(button.command, "utf8") <= 64);
    assert.deepEqual(parseReviewButtonCommand(button.command), { action: button.label.toUpperCase(), proposalId: id, version });
  }
  assert.equal(validReviewButtons(buttons), true);
});

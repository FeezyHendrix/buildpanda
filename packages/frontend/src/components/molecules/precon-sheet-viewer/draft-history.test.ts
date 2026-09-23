import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_DRAFT, addDraftPoint, draftFromVertices, type DraftState } from "./draft-maths.ts";
import {
  EMPTY_DRAFT_HISTORY,
  canRedoDraft,
  canUndoDraft,
  pushDraft,
  redoDraft,
  undoDraft,
  withoutTrailingDuplicate,
  type DraftHistory,
} from "./draft-history.ts";

const A = [10, 10];
const B = [50, 10];
const C = [50, 40];

/** Draw A, B, C as three plain clicks through the history. */
function drawABC(): DraftHistory {
  let history = EMPTY_DRAFT_HISTORY;
  for (const pt of [A, B, C]) history = pushDraft(history, addDraftPoint(history.present, pt, false));
  return history;
}

test("each click is one history entry; undo removes the last placement", () => {
  const history = drawABC();
  assert.equal(history.present.vertices.length, 3);
  const undone = undoDraft(history);
  assert.deepEqual(undone.present.vertices, [A, B]);
  assert.deepEqual(undone.present.anchors, [A, B]);
});

test("redo restores the removed placement", () => {
  const undone = undoDraft(drawABC());
  assert.equal(canRedoDraft(undone), true);
  const redone = redoDraft(undone);
  assert.deepEqual(redone.present.vertices, [A, B, C]);
});

test("undo on an empty history is a no-op returning the same object", () => {
  assert.equal(undoDraft(EMPTY_DRAFT_HISTORY), EMPTY_DRAFT_HISTORY);
  assert.equal(redoDraft(EMPTY_DRAFT_HISTORY), EMPTY_DRAFT_HISTORY);
  assert.equal(canUndoDraft(EMPTY_DRAFT_HISTORY), false);
  assert.equal(canRedoDraft(EMPTY_DRAFT_HISTORY), false);
});

test("a completed arc undoes as one gesture back to the pending midpoint", () => {
  let history = EMPTY_DRAFT_HISTORY;
  history = pushDraft(history, addDraftPoint(history.present, A, false));
  history = pushDraft(history, addDraftPoint(history.present, [30, 30], true)); // Alt-click: arc midpoint
  assert.deepEqual(history.present.arcMid, [30, 30]);
  history = pushDraft(history, addDraftPoint(history.present, B, false)); // closes the arc, densified
  assert.ok(history.present.vertices.length > 3, "arc close densifies into many vertices");
  assert.equal(history.present.anchors.length, 2);

  const undone = undoDraft(history);
  assert.deepEqual(undone.present.vertices, [A], "one undo removes every densified arc vertex");
  assert.deepEqual(undone.present.arcMid, [30, 30], "the arc midpoint is recoverable");
  const cleared = undoDraft(undone);
  assert.equal(cleared.present.arcMid, null, "a second undo abandons the pending midpoint");

  const redone = redoDraft(redoDraft(cleared));
  assert.deepEqual(redone.present.vertices, history.present.vertices, "redo rebuilds the whole arc");
});

test("a new placement after undo abandons the redo branch", () => {
  const undone = undoDraft(drawABC());
  const branched = pushDraft(undone, addDraftPoint(undone.present, [80, 80], false));
  assert.equal(canRedoDraft(branched), false);
  assert.deepEqual(branched.present.vertices, [A, B, [80, 80]]);
});

test("a ready-made replacement (dragged rectangle) is one history entry", () => {
  const history = drawABC();
  const rect: DraftState = draftFromVertices([
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]);
  const replaced = pushDraft(history, rect);
  assert.equal(replaced.present.vertices.length, 4);
  assert.deepEqual(undoDraft(replaced).present.vertices, [A, B, C], "undo of a replacement restores the clicks");
});

test("pushing an identical state is a no-op (no phantom history entry)", () => {
  const history = drawABC();
  assert.equal(pushDraft(history, history.present), history);
});

test("withoutTrailingDuplicate drops the double-click's repeated final anchor", () => {
  const doubled = addDraftPoint(addDraftPoint(addDraftPoint(EMPTY_DRAFT, A, false), B, false), B, false);
  const deduped = withoutTrailingDuplicate(doubled);
  assert.deepEqual(deduped.vertices, [A, B]);
  assert.deepEqual(deduped.anchors, [A, B]);
});

test("withoutTrailingDuplicate leaves distinct final points alone", () => {
  const clean = addDraftPoint(addDraftPoint(EMPTY_DRAFT, A, false), B, false);
  assert.equal(withoutTrailingDuplicate(clean), clean);
  assert.equal(withoutTrailingDuplicate(EMPTY_DRAFT), EMPTY_DRAFT);
});

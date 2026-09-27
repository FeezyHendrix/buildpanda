// The three decisions that are not about cells: when a retry is the same save,
// what the workbook may offer to do about a figure, and which panes fit.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { candidateFingerprint, compareForConflict, planSave } from "./save-plan";
import { bindingAt, needsSourceChooser, sourceActionFor, type FocusedBinding } from "./source-action";
import {
  canSplit,
  defaultModeFor,
  MIN_DRAWING_WIDTH,
  MIN_SPLIT_WIDTH,
  MIN_WORKBOOK_WIDTH,
  PANE_GAP,
  resolveMode,
} from "../precon-session/workspace-mode";
import { columnPresentation, readableWidth } from "./column-presentation";
import type { WorkbookBasis, WorkbookBinding, WorkbookDocument, WorkbookLayout, WorkbookSnapshot } from "@/api/workbook-types";

const snapshot = (cells: Record<string, Record<string, { v?: string | number; f?: string }>>): WorkbookSnapshot => ({
  id: "wb",
  name: "Takeoff workbook",
  sheetOrder: ["s1"],
  styles: {},
  sheets: { s1: { id: "s1", name: "Bill No. 1", rowCount: 20, columnCount: 10, cellData: cells } },
});

describe("when a retry is the same save", () => {
  const request = {
    expectedVersion: 3,
    expectedSourceFingerprint: "a".repeat(64),
    snapshot: snapshot({ "1": { "6": { f: "=D2*2" } } }),
  };

  it("reuses the operation id for identical work, so the server can answer from its record", () => {
    const first = planSave(null, candidateFingerprint(request), () => "id-1");
    const retry = planSave(first, candidateFingerprint(request), () => "id-2");
    assert.equal(retry.operationId, "id-1");
    assert.equal(retry.attempts, 2);
  });

  it("mints a fresh id once the work changes, so a receipt never describes a document that moved", () => {
    const first = planSave(null, candidateFingerprint(request), () => "id-1");
    const changed = { ...request, snapshot: snapshot({ "1": { "6": { f: "=D2*3" } } }) };
    const next = planSave(first, candidateFingerprint(changed), () => "id-2");
    assert.equal(next.operationId, "id-2");
    assert.equal(next.attempts, 1);
  });

  it("treats a changed base version as different work, because it is a different save", () => {
    const first = planSave(null, candidateFingerprint(request), () => "id-1");
    const rebased = planSave(first, candidateFingerprint({ ...request, expectedVersion: 4 }), () => "id-2");
    assert.equal(rebased.operationId, "id-2");
  });

  it("gives a stable fingerprint for the same content, whatever the object identity", () => {
    assert.equal(candidateFingerprint(request), candidateFingerprint({ ...request, snapshot: request.snapshot }));
  });
});

describe("what a conflict actually changed", () => {
  const server = (cells: Parameters<typeof snapshot>[0]): WorkbookDocument =>
    ({
      sessionId: "pcs",
      version: 7,
      engineVersion: "univer-oss-1.0.0",
      snapshot: snapshot(cells),
      layout: {
        schemaVersion: 1,
        sheets: [
          {
            sheetId: "s1",
            kind: "bill",
            billId: "b1",
            name: "Bill No. 1",
            label: "Bill No. 1",
            firstBodyRow: 1,
            freeColumnStart: 6,
            columns: {},
            bindings: [],
          },
        ],
      } satisfies WorkbookLayout,
      values: {},
      errors: [],
      sourceFingerprint: "b".repeat(64),
      reviewRollup: {
        boundRows: 1,
        verified: 0,
        needsReview: 1,
        unreviewed: 0,
        withdrawn: 0,
        missingBasis: 0,
        stated: 0,
        sourcesMoved: false,
      },
      updatedAt: "2026-09-23T12:00:00.000Z",
      updatedBy: "usr_b",
      history: [],
    }) as WorkbookDocument;

  it("lists only the cells that actually disagree", () => {
    const mine = snapshot({ "1": { "6": { f: "=D2*2" }, "7": { v: "mine" } } });
    const report = compareForConflict(mine, server({ "1": { "6": { f: "=D2*3" }, "7": { v: "mine" } } }));
    assert.equal(report.lines.length, 1);
    assert.equal(report.lines[0]!.mine, "=D2*2");
    assert.equal(report.lines[0]!.theirs, "=D2*3");
  });

  it("names a cell the other side emptied rather than skipping it", () => {
    const report = compareForConflict(snapshot({ "1": { "6": { v: 42 } } }), server({ "1": {} }));
    assert.equal(report.lines[0]!.mine, "42");
    assert.equal(report.lines[0]!.theirs, "(empty)");
  });

  it("reports nothing to decide when the two agree", () => {
    const same = { "1": { "6": { f: "=D2*2" } } };
    assert.deepEqual(compareForConflict(snapshot(same), server(same)).lines, []);
  });

  it("uses the worksheet's current title, never its pinned formula name", () => {
    const report = compareForConflict(snapshot({ "1": { "6": { v: 1 } } }), server({ "1": { "6": { v: 2 } } }));
    assert.match(report.lines[0]!.label, /^Bill No\. 1 · row 2, column 7$/);
  });
});

describe("what may be done about a figure", () => {
  const binding = (basis: WorkbookBasis, over: Partial<WorkbookBinding> = {}): FocusedBinding => ({
    sheet: {
      sheetId: "s1",
      kind: "bill",
      billId: "b1",
      name: "Bill No. 1",
      label: "Bill No. 1",
      firstBodyRow: 1,
      freeColumnStart: 6,
      columns: {},
      bindings: [],
    },
    binding: {
      rowId: "pbr_1",
      rowVersion: 3,
      gridRow: 1,
      state: "bound",
      basis,
      remeasurable: basis === "measured",
      geometryIds: basis === "measured" ? ["pgeo_1"] : [],
      sourceSheetIds: basis === "measured" ? ["pcsh_1"] : [],
      revision: 2,
      ...over,
    },
    label: "QA rectangle 24m2",
  });

  it("opens the existing annotation for a measured figure, carrying its revision", () => {
    const action = sourceActionFor(binding("measured"));
    assert.equal(action.kind, "remeasure");
    assert.deepEqual(action.kind === "remeasure" ? action.geometryIds : [], ["pgeo_1"]);
    assert.equal(action.kind === "remeasure" ? action.revision : null, 2);
  });

  it("sends a legacy line to the basis-confirmation flow, since there is nothing to reopen", () => {
    assert.equal(sourceActionFor(binding("legacy")).kind, "confirm-basis");
  });

  it("offers to DRAW for a stated figure and never fabricates an annotation", () => {
    const action = sourceActionFor(binding("stated"));
    assert.equal(action.kind, "draw");
    assert.notEqual(action.kind, "remeasure");
  });

  it("offers nothing on a heading", () => {
    assert.equal(sourceActionFor(binding("narrative")).kind, "none");
  });

  it("offers nothing on a withdrawn line", () => {
    const action = sourceActionFor(binding("measured", { state: "withdrawn" }));
    assert.equal(action.kind, "none");
    assert.match(action.kind === "none" ? action.reason : "", /withdrawn/);
  });

  it("asks which measurement when several feed one figure", () => {
    const many = sourceActionFor(binding("measured", { geometryIds: ["a", "b", "c"] }));
    assert.equal(needsSourceChooser(many), true);
    assert.equal(needsSourceChooser(sourceActionFor(binding("measured"))), false);
  });

  it("finds nothing on a summary or scratch worksheet", () => {
    const layout: WorkbookLayout = {
      schemaVersion: 1,
      sheets: [
        {
          sheetId: "wb-summary",
          kind: "summary",
          billId: null,
          name: "Summary",
          label: "Summary",
          firstBodyRow: 2,
          freeColumnStart: 2,
          columns: {},
          bindings: [],
        },
      ],
    };
    assert.equal(bindingAt(layout, "wb-summary", 2, () => ""), null);
  });
});

describe("which panes fit", () => {
  it("splits only when both panes get a width they can be worked in", () => {
    assert.equal(canSplit(MIN_SPLIT_WIDTH), true);
    assert.equal(canSplit(MIN_SPLIT_WIDTH - 1), false);
    assert.ok(MIN_SPLIT_WIDTH >= MIN_WORKBOOK_WIDTH + MIN_DRAWING_WIDTH);
  });

  it("shows one pane when Split was asked for but does not fit — and remembers the request", () => {
    const narrow = resolveMode("split", 700, true);
    assert.deepEqual(narrow, { showWorkbook: true, showDrawings: false, splitCollapsed: true });
    // The SAME request, once there is room, is honoured without asking again.
    assert.deepEqual(resolveMode("split", 1280, true), {
      showWorkbook: true,
      showDrawings: true,
      splitCollapsed: false,
    });
  });

  it("collapses to the DRAWING when a source action asked for one", () => {
    // Pressing Remeasure in a window too narrow to split must show the drawing
    // that was asked for, not the workbook that was already on screen.
    assert.deepEqual(resolveMode("split", 700, true, "drawings"), {
      showWorkbook: false,
      showDrawings: true,
      splitCollapsed: true,
    });
  });

  it("splits at 1280, because the bill panel is not beside the workbook", () => {
    // 1280 viewport − 240 sidebar − 48 padding ≈ 992 of workspace, and in Split
    // the panes get all of it: the bill panel belongs to the drawing alone.
    // The review rejected a build where its 420px left a 560px grid.
    const workspace = 992;
    assert.equal(canSplit(workspace), true);
    assert.ok(workspace - PANE_GAP >= MIN_WORKBOOK_WIDTH + MIN_DRAWING_WIDTH);
  });

  it("still refuses a split no arithmetic can make fit", () => {
    assert.equal(canSplit(900), false);
  });

  it("shows the workbook alone when the take-off has no drawings", () => {
    assert.deepEqual(resolveMode("drawings", 1280, false), {
      showWorkbook: true,
      showDrawings: false,
      splitCollapsed: false,
    });
  });

  it("honours an explicit single-pane choice at any width", () => {
    assert.deepEqual(resolveMode("drawings", 375, true), {
      showWorkbook: false,
      showDrawings: true,
      splitCollapsed: false,
    });
    assert.deepEqual(resolveMode("workbook", 375, true), {
      showWorkbook: true,
      showDrawings: false,
      splitCollapsed: false,
    });
  });

  it("opens an automatic take-off on the workbook and a hand one on the drawings", () => {
    assert.equal(defaultModeFor("ai"), "workbook");
    assert.equal(defaultModeFor("manual"), "drawings");
  });
});

describe("how the columns are drawn on a phone", () => {
  const bill = {
    sheetId: "wb-bill-1",
    kind: "bill",
    billId: "b1",
    name: "Bill No. 1",
    label: "Bill No. 1",
    firstBodyRow: 1,
    freeColumnStart: 6,
    columns: { "0": "code", "1": "description", "2": "unit", "3": "qty", "4": "rate", "5": "amount" },
    bindings: [],
  } as const;

  /** A 375px phone, less the workbook's own border and the row header gutter. */
  const PHONE_GRID = 300;

  it("fits description, unit and quantity together on a phone", () => {
    assert.ok(
      readableWidth(bill, true) <= PHONE_GRID,
      `the three columns a surveyor reads take ${readableWidth(bill, true)}px, over a ${PHONE_GRID}px grid`,
    );
    // The roomy layout deliberately does NOT fit — that is the defect being fixed.
    assert.ok(readableWidth(bill, false) > PHONE_GRID);
  });

  it("folds the code column away on a phone and keeps it at full width", () => {
    const narrow = columnPresentation(bill, true);
    const wide = columnPresentation(bill, false);
    assert.equal(narrow.find((c) => c.index === 0)?.hidden, true);
    assert.equal(wide.find((c) => c.index === 0)?.hidden, false);
  });

  it("never renumbers a column: the indices are the server's at every width", () => {
    const indices = (compact: boolean) => columnPresentation(bill, compact).map((c) => c.index);
    assert.deepEqual(indices(true), indices(false));
    // The qty the server put at index 3 is still drawn at index 3, folded or not.
    const qtyAt = (compact: boolean) => columnPresentation(bill, compact).find((c) => c.index === 3);
    assert.ok(qtyAt(true) && !qtyAt(true)!.hidden);
    assert.deepEqual(indices(true).slice(0, 6), [0, 1, 2, 3, 4, 5]);
  });

  it("keeps every column addressable — hiding one is not dropping it", () => {
    const narrow = columnPresentation(bill, true);
    for (const index of [0, 1, 2, 3, 4, 5]) {
      assert.ok(
        narrow.some((column) => column.index === index),
        `column ${index} must still be presented, hidden or not`,
      );
    }
    assert.equal(narrow.filter((column) => column.hidden).length, 1, "only the blank code column folds away");
  });

  it("sizes the free calculation columns at both widths", () => {
    for (const compact of [true, false]) {
      const free = columnPresentation(bill, compact).filter((c) => c.index >= bill.freeColumnStart);
      assert.ok(free.length >= 8);
      assert.ok(free.every((c) => c.width > 0 && !c.hidden));
    }
  });

  it("has no opinion about a scratch worksheet — it is the user's outright", () => {
    const scratch = { ...bill, sheetId: "s1", kind: "scratch", columns: {}, freeColumnStart: 0 } as const;
    assert.deepEqual(columnPresentation(scratch, true), []);
  });
});

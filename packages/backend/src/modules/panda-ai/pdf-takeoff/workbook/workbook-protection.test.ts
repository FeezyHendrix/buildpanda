// What a client is NOT allowed to do to a measured quantity, and what an undo
// is NOT allowed to do to a colleague.
//
// The protection is a comparison, not a field list: the server renders what the
// generated block should say and every generated cell in the candidate must
// equal it. So these tests work the way an attacker would — take a document the
// server itself produced, change one thing, and send it back.
//
// A refusal must be WHOLE. Several of these deliberately pair a forbidden edit
// with a legitimate one, because "the bad half was stripped and the good half
// saved" is the failure mode that would tell a QS their paste worked.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hydrateWorkbook } from "./hydrate.ts";
import { buildGeneratedLayout, billSheetIdFor, withScratchSheets, workbookIdFor } from "./layout.ts";
import { sanitizeCandidate, WorkbookProtectedError } from "./sanitize.ts";
import { userProjection, stateBefore, rowDeltas } from "./audit.ts";
import { eligibilityOf, workbookChainIsClean, WORKBOOK_REFUSALS } from "./history.ts";
import { restorePatches } from "./reverse.ts";
import { liveRowsById } from "./document.ts";
import { sourceRow, takeoffSource } from "./workbook-source-fixtures.ts";
import type { WorkbookCell, WorkbookSnapshot } from "./engine-types.ts";
import type { WorkbookLayout, WorkbookStateV1 } from "./types.ts";
import type { PreconAuditEventRow } from "../types.ts";

const BILL = billSheetIdFor("bill-1");

function served(source = takeoffSource()): { snapshot: WorkbookSnapshot; layout: WorkbookLayout } {
  const generated = buildGeneratedLayout(source);
  const layout = withScratchSheets(generated, generated.map((sheet) => sheet.sheetId), (id) => id);
  const snapshot = hydrateWorkbook({
    workbookId: workbookIdFor("session-1"),
    workbookName: "Takeoff workbook",
    layout,
    rows: liveRowsById(source),
    user: null,
  });
  return { snapshot, layout };
}

/** The document as the server sent it, with one cell changed. */
function tampered(edit: (cells: Record<string, Record<string, WorkbookCell>>) => void): {
  candidate: WorkbookSnapshot;
  layout: WorkbookLayout;
  trusted: WorkbookSnapshot;
} {
  const { snapshot, layout } = served();
  const candidate = structuredClone(snapshot) as { sheets: Record<string, { cellData: Record<string, Record<string, WorkbookCell>> }> } & WorkbookSnapshot;
  edit(candidate.sheets[BILL]!.cellData as Record<string, Record<string, WorkbookCell>>);
  return { candidate, layout, trusted: snapshot };
}

const refusal = (fn: () => void): WorkbookProtectedError => {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof WorkbookProtectedError, `expected a refusal, got ${String(error)}`);
    return error;
  }
  throw new assert.AssertionError({ message: "the candidate was accepted when it should have been refused" });
};

describe("a measured figure cannot be typed over", () => {
  it("accepts the document it just sent, unchanged", () => {
    const { snapshot, layout } = served();
    assert.doesNotThrow(() => sanitizeCandidate(snapshot, layout, snapshot));
  });

  it("refuses a changed quantity", () => {
    const { candidate, layout, trusted } = tampered((cells) => {
      cells["1"]!["3"] = { v: 9999, t: 2 };
    });
    const error = refusal(() => sanitizeCandidate(candidate, layout, trusted));
    assert.match(error.message, /qty/);
    assert.equal(error.statusCode, 422);
  });

  it("refuses a quantity replaced by a formula that merely evaluates to the same number", () => {
    const { candidate, layout, trusted } = tampered((cells) => {
      cells["1"]!["3"] = { f: "=44" };
    });
    refusal(() => sanitizeCandidate(candidate, layout, trusted));
  });

  it("refuses a DELETED quantity as firmly as a changed one", () => {
    const { candidate, layout, trusted } = tampered((cells) => {
      delete cells["1"]!["3"];
    });
    refusal(() => sanitizeCandidate(candidate, layout, trusted));
  });

  it("refuses a changed unit and a changed code", () => {
    for (const column of ["0", "2"]) {
      const { candidate, layout, trusted } = tampered((cells) => {
        cells["1"]![column] = { v: "tampered", t: 1 };
      });
      refusal(() => sanitizeCandidate(candidate, layout, trusted));
    }
  });

  it("refuses a rate typed straight into the grid with no patch behind it", () => {
    const { candidate, layout, trusted } = tampered((cells) => {
      cells["1"]!["4"] = { v: 7777, t: 2 };
    });
    refusal(() => sanitizeCandidate(candidate, layout, trusted));
  });

  it("refuses the WHOLE paste, never just the forbidden half", () => {
    const { candidate, layout, trusted } = tampered((cells) => {
      cells["1"]!["3"] = { v: 9999, t: 2 };
      cells["1"]!["6"] = { f: "=D2*2" };
    });
    refusal(() => sanitizeCandidate(candidate, layout, trusted));
  });
});

describe("what the user genuinely owns is left alone", () => {
  it("allows any formula in a free calculation column", () => {
    const { candidate, layout, trusted } = tampered((cells) => {
      cells["1"]!["6"] = { f: "=D2*2" };
      cells["1"]!["7"] = { f: '=IF(D2>10,"big","small")' };
    });
    assert.doesNotThrow(() => sanitizeCandidate(candidate, layout, trusted));
  });

  it("allows a generated cell to be FORMATTED, because formatting never moves a figure", () => {
    const { candidate, layout, trusted } = tampered((cells) => {
      cells["1"]!["3"] = { ...cells["1"]!["3"]!, s: "bold-red" };
    });
    assert.doesNotThrow(() => sanitizeCandidate(candidate, layout, trusted));
  });
});

describe("a figure the bill does not carry cannot be forged into the gap", () => {
  // A bill line with no rate renders NO rate cell, so that address appears
  // nowhere in the trusted document and a comparison driven only by the trusted
  // side never looked at it. A forged figure passed the gate and was then
  // dropped by the rebuild: nothing corrupted, but the user told "saved" while
  // half their paste was silently discarded — exactly what refusing whole
  // exists to prevent.
  const unpriced = () =>
    takeoffSource({
      rows: [sourceRow({ id: "row-a", sort: 0, qty: null, rate: null, amount: null })],
      geometries: [],
    });

  const forge = (column: string, cell: WorkbookCell) => {
    const { snapshot, layout } = served(unpriced());
    const candidate = structuredClone(snapshot) as WorkbookSnapshot & {
      sheets: Record<string, { cellData: Record<string, Record<string, WorkbookCell>> }>;
    };
    const line = candidate.sheets[BILL]!.cellData;
    // Each case proves its own premise rather than trusting the fixture.
    assert.equal(line["1"]?.[column], undefined, `column ${column} must start empty for this case to mean anything`);
    line["1"] = { ...line["1"], [column]: cell };
    return () => sanitizeCandidate(candidate, layout, snapshot);
  };

  for (const [column, field] of [
    ["3", "qty"],
    ["4", "rate"],
    ["5", "amount"],
  ] as const) {
    it(`a forged ${field} at an address the bill left empty is refused`, () => {
      const error = refusal(forge(column, { v: 9999, t: 2 }));
      assert.match(error.message, new RegExp(field));
      assert.match(error.message, /9999/);
    });
  }

  it("a forged figure is refused even when a perfectly legitimate edit travels with it", () => {
    const { snapshot, layout } = served(unpriced());
    const candidate = structuredClone(snapshot) as WorkbookSnapshot & {
      sheets: Record<string, { cellData: Record<string, Record<string, WorkbookCell>> }>;
      sheetOrder: string[];
    };
    candidate.sheets[BILL]!.cellData["1"] = {
      ...candidate.sheets[BILL]!.cellData["1"],
      "5": { v: 123456, t: 2 },
      "6": { f: "=1+1" },
    };
    refusal(() => sanitizeCandidate(candidate, layout, snapshot));
  });

  it("an empty cell is still empty, so a rightful blank is not mistaken for a forgery", () => {
    for (const blank of [{}, { v: null }, { s: "bold" }] as WorkbookCell[]) {
      assert.doesNotThrow(forge("4", blank), `${JSON.stringify(blank)} must round-trip`);
    }
  });

  it("zero is a figure, not a blank, so it cannot be introduced where there is none", () => {
    refusal(forge("4", { v: 0, t: 2 }));
  });

  it("but a line genuinely priced at zero round-trips exactly", () => {
    const priced = takeoffSource({
      rows: [sourceRow({ id: "row-a", sort: 0, qty: "0.00", rate: "0.00", amount: "0.00" })],
      geometries: [],
    });
    const { snapshot, layout } = served(priced);
    assert.deepEqual(
      (snapshot.sheets[BILL]!.cellData["1"] as Record<string, WorkbookCell>)["4"],
      { v: 0, t: 2 },
      "a real zero is rendered, so it has an address to be compared at",
    );
    assert.doesNotThrow(() => sanitizeCandidate(snapshot, layout, snapshot));
  });
});

describe("the reserve below the bill is not free space", () => {
  it("refuses a value written into a protected column of a row with no bill line yet", () => {
    const { candidate, layout, trusted } = tampered((cells) => {
      cells["40"] = { "3": { v: 1, t: 2 } };
    });
    const error = refusal(() => sanitizeCandidate(candidate, layout, trusted));
    assert.match(error.message, /reserved/);
  });

  it("allows the same row in a FREE column", () => {
    const { candidate, layout, trusted } = tampered((cells) => {
      cells["40"] = { "6": { v: 1, t: 2 } };
    });
    assert.doesNotThrow(() => sanitizeCandidate(candidate, layout, trusted));
  });
});

describe("the shape of the workbook is the server's", () => {
  it("refuses a removed generated worksheet", () => {
    const { snapshot, layout } = served();
    const candidate = structuredClone(snapshot);
    delete (candidate.sheets as Record<string, unknown>)[BILL];
    refusal(() => sanitizeCandidate(candidate, layout, snapshot));
  });

  it("refuses a renamed generated worksheet", () => {
    const { snapshot, layout } = served();
    const candidate = structuredClone(snapshot);
    (candidate.sheets[BILL] as { name: string }).name = "Mine now";
    refusal(() => sanitizeCandidate(candidate, layout, snapshot));
  });

  it("refuses a worksheet shrunk below the rows the bill needs", () => {
    const { snapshot, layout } = served();
    const candidate = structuredClone(snapshot);
    (candidate.sheets[BILL] as { rowCount: number }).rowCount = 1;
    refusal(() => sanitizeCandidate(candidate, layout, snapshot));
  });

  it("refuses a scratch worksheet that claims a generated id", () => {
    const { snapshot, layout } = served();
    const candidate = structuredClone(snapshot) as WorkbookSnapshot & { sheetOrder: string[] };
    candidate.sheetOrder = [...candidate.sheetOrder, billSheetIdFor("bill-99")];
    refusal(() => sanitizeCandidate(candidate, layout, snapshot));
  });

  it("does NOT refuse growing a worksheet, which is what every real save does", () => {
    const { snapshot, layout } = served();
    const candidate = structuredClone(snapshot);
    (candidate.sheets[BILL] as { rowCount: number }).rowCount += 500;
    (candidate.sheets[BILL] as { columnCount: number }).columnCount += 20;
    assert.doesNotThrow(() => sanitizeCandidate(candidate, layout, snapshot));
  });
});

describe("the audit entry records the user's work, not the bill's", () => {
  it("strips every generated cell and keeps every free one", () => {
    const { snapshot, layout } = served();
    const withUserWork = structuredClone(snapshot);
    (withUserWork.sheets[BILL]!.cellData as Record<string, Record<string, WorkbookCell>>)["1"]!["6"] = { f: "=D2*2" };

    const projection = userProjection(withUserWork, layout);
    const kept = projection.sheets[BILL]!.cellData as Record<string, Record<string, WorkbookCell>>;
    assert.deepEqual(kept["1"], { "6": { f: "=D2*2" } }, "only the free column survives");
    assert.equal(kept["0"], undefined, "the generated heading row is not recorded");
  });

  it("records an absent workbook as absent, so undoing the first save restores the absence", () => {
    const state = stateBefore(undefined, []);
    assert.equal(state.version, 0);
    assert.equal(state.snapshot, null);
  });
});

describe("an undo withdraws your own act and nobody else's", () => {
  const event = (over: Partial<PreconAuditEventRow>): PreconAuditEventRow =>
    ({
      id: "e1",
      session_id: "session-1",
      row_id: null,
      actor: "ann",
      action: "workbook_edited",
      before: { schemaVersion: 1, state: { version: 0, snapshot: null, layout: null, sourceFingerprint: null, rows: {} } },
      after: {
        schemaVersion: 1,
        state: { version: 1, snapshot: null, layout: null, sourceFingerprint: null, rows: {} },
        requestFingerprint: "f",
        receipt: { eventId: "e1", operationId: "op1", replayed: false, version: 1, sourceFingerprint: "f", rows: [] },
      },
      operation_id: "op1",
      reverses_event_id: null,
      created_at: new Date("2026-01-01T10:00:00Z"),
      ...over,
    }) as PreconAuditEventRow;

  it("allows the actor's own most recent entry", () => {
    assert.deepEqual(eligibilityOf(event({}), [], null, "ann"), { eligible: true, reason: null });
  });

  it("refuses a colleague's entry", () => {
    assert.equal(eligibilityOf(event({}), [], null, "bob").reason, WORKBOOK_REFUSALS.notYours);
  });

  it("refuses an entry already undone", () => {
    assert.equal(eligibilityOf(event({}), [], "e2", "ann").reason, WORKBOOK_REFUSALS.alreadyReversed);
  });

  it("refuses when a COLLEAGUE has saved since, even if their content matched", () => {
    const later = [event({ id: "e2", actor: "bob", created_at: new Date("2026-01-01T11:00:00Z") })];
    assert.equal(eligibilityOf(event({}), later, null, "ann").reason, WORKBOOK_REFUSALS.movedOn);
  });

  it("refuses an entry that recorded no state to put back", () => {
    assert.equal(eligibilityOf(event({ before: null }), [], null, "ann").reason, WORKBOOK_REFUSALS.noState);
  });

  it("abandons redo once the actor makes a new edit on top of the undo", () => {
    const undo = event({ id: "e2", reverses_event_id: "e1", created_at: new Date("2026-01-01T11:00:00Z") });
    const fresh = event({ id: "e3", created_at: new Date("2026-01-01T12:00:00Z") });
    assert.equal(workbookChainIsClean(undo, [fresh], "ann"), false);
  });

  it("still allows undoing the actor's own undo when nothing followed it", () => {
    const undo = event({ id: "e2", reverses_event_id: "e1", created_at: new Date("2026-01-01T11:00:00Z") });
    assert.equal(workbookChainIsClean(undo, [], "ann"), true);
  });
});

describe("an undo puts figures back without erasing what happened since", () => {
  const stateOf = (rows: WorkbookStateV1["rows"]): WorkbookStateV1 => ({
    version: 1,
    snapshot: null,
    layout: null,
    sourceFingerprint: "f",
    rows,
  });

  it("restores the rate the entry changed", () => {
    const live = liveRowsById(
      takeoffSource({ rows: [sourceRow({ id: "row-a", sort: 0, rate: "6000.00", version: 2 })] }),
    );
    const before = stateOf(rowDeltas([sourceRow({ id: "row-a", sort: 0, rate: "5000.00", version: 1 })]));
    const after = stateOf(rowDeltas([sourceRow({ id: "row-a", sort: 0, rate: "6000.00", version: 2 })]));

    const patches = restorePatches(before, after, live);
    assert.deepEqual(patches, [{ rowId: "row-a", version: 2, description: "Line 0", rate: 5000 }]);
  });

  it("addresses the CURRENT version, so a stale patch cannot be replayed blindly", () => {
    const live = liveRowsById(
      takeoffSource({ rows: [sourceRow({ id: "row-a", sort: 0, rate: "6000.00", version: 9 })] }),
    );
    const before = stateOf(rowDeltas([sourceRow({ id: "row-a", sort: 0, rate: "5000.00", version: 1 })]));
    const after = stateOf(rowDeltas([sourceRow({ id: "row-a", sort: 0, rate: "6000.00", version: 2 })]));
    assert.equal(restorePatches(before, after, live)?.[0]?.version, 9);
  });

  it("refuses when the line no longer says what the entry left it saying", () => {
    const live = liveRowsById(
      takeoffSource({ rows: [sourceRow({ id: "row-a", sort: 0, rate: "8888.00", version: 3 })] }),
    );
    const before = stateOf(rowDeltas([sourceRow({ id: "row-a", sort: 0, rate: "5000.00" })]));
    const after = stateOf(rowDeltas([sourceRow({ id: "row-a", sort: 0, rate: "6000.00" })]));
    assert.equal(restorePatches(before, after, live), null, "someone else moved it; a person must decide");
  });

  it("refuses when the line has been withdrawn since", () => {
    const live = liveRowsById(
      takeoffSource({ rows: [sourceRow({ id: "row-a", sort: 0, rate: "6000.00", withdrawn: true })] }),
    );
    const before = stateOf(rowDeltas([sourceRow({ id: "row-a", sort: 0, rate: "5000.00" })]));
    const after = stateOf(rowDeltas([sourceRow({ id: "row-a", sort: 0, rate: "6000.00" })]));
    assert.equal(restorePatches(before, after, live), null);
  });

  it("writes nothing for a line the entry never touched", () => {
    const live = liveRowsById(takeoffSource({ rows: [sourceRow({ id: "row-a", sort: 0, rate: "5000.00" })] }));
    const same = rowDeltas([sourceRow({ id: "row-a", sort: 0, rate: "5000.00" })]);
    assert.deepEqual(restorePatches(stateOf(same), stateOf(same), live), []);
  });

  it("can clear a rate the entry introduced, rather than leaving it half undone", () => {
    const live = liveRowsById(
      takeoffSource({ rows: [sourceRow({ id: "row-a", sort: 0, rate: "6000.00", version: 2 })] }),
    );
    const before = stateOf(rowDeltas([sourceRow({ id: "row-a", sort: 0, rate: null, amount: null })]));
    const after = stateOf(rowDeltas([sourceRow({ id: "row-a", sort: 0, rate: "6000.00", version: 2 })]));
    assert.equal(restorePatches(before, after, live)?.[0]?.rate, null);
  });
});

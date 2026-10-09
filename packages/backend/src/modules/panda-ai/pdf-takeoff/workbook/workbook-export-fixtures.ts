// The hostile take-off the export suites are built on.
//
// A workbook SAVED while the bill said 44, exported after a remeasure moved it
// to 52 and a line was withdrawn. Everything awkward is deliberate and each
// piece is load-bearing:
//
//   * a free-column formula stored WITH the number the grid was showing at the
//     time, because Univer returns a stored value instead of evaluating and a
//     fixture without it cannot tell a fresh figure from a pinned one;
//   * a worksheet named three characters past what Excel can hold, referenced
//     by a formula on another sheet, so a rename that forgot its references
//     would show up as a `#REF!`;
//   * a line with no rate, so an absent figure has somewhere to go wrong;
//   * a cell a person formatted and then emptied, which is populated and must
//     still arrive blank rather than as a nil price.

import { hydrateWorkbook } from "./hydrate.ts";
import { liveRowsById } from "./document.ts";
import { billSheetIdFor, buildGeneratedLayout, SUMMARY_SHEET_ID, withScratchSheets, workbookIdFor } from "./layout.ts";
import { sourceBill, sourceGeometry, sourceRow, takeoffSource } from "./workbook-source-fixtures.ts";
import type { WorkbookSnapshot } from "./engine-types.ts";
import type { WorkbookSourceSet } from "./source.ts";
import type { PreconWorkbookRow } from "./types.ts";

export const BILL_SHEET = billSheetIdFor("bill-1");
export const SCRATCH_SHEET = "scratch-rates";
export const STYLE_ID = "st-money";

/** 34 characters: legal in BuildPanda, three too many for Excel. */
export const LONG_SCRATCH_NAME = "Ground floor working rate schedule";
export const TRUNCATED_SCRATCH_NAME = "Ground floor working rate sched";

export function userDocument(): WorkbookSnapshot {
  return {
    id: workbookIdFor("session-1"),
    name: "Takeoff workbook",
    sheetOrder: [SUMMARY_SHEET_ID, BILL_SHEET, SCRATCH_SHEET],
    sheets: {
      [SUMMARY_SHEET_ID]: {
        id: SUMMARY_SHEET_ID,
        name: "Summary",
        rowCount: 60,
        columnCount: 12,
        cellData: { "0": { "2": { f: `='${LONG_SCRATCH_NAME}'!B1` } } },
      },
      [BILL_SHEET]: {
        id: BILL_SHEET,
        name: "Bill No. 1",
        rowCount: 60,
        columnCount: 16,
        cellData: { "1": { "6": { f: "=D2*2", v: 88, t: 2, s: STYLE_ID } } },
      },
      [SCRATCH_SHEET]: {
        id: SCRATCH_SHEET,
        name: LONG_SCRATCH_NAME,
        rowCount: 40,
        columnCount: 10,
        cellData: {
          "0": { "0": { v: "Measured amount", t: 1 }, "1": { f: "=SUM('Bill No. 1'!F2:F3)" } },
          "1": { "0": { v: "Uplift at 10%", t: 1 }, "1": { f: "=ROUND(B1*0.1,2)" } },
          "2": { "0": { v: "Contingency (not yet agreed)", t: 1 }, "1": { v: null, s: STYLE_ID } },
        },
      },
    },
    styles: { [STYLE_ID]: { bl: 1, ht: 3, n: { pattern: "#,##0.00" } } },
  };
}

const ROW_C = sourceRow({ id: "row-c", sort: 2, qty: "8.00", rate: "100.00", amount: "800.00" });
/** A priced line nobody has rated yet: its rate and amount must export BLANK. */
const ROW_D = sourceRow({ id: "row-d", sort: 3, qty: "5.00", rate: null, amount: null });

const withRows = (first: ReturnType<typeof sourceRow>, third: ReturnType<typeof sourceRow>): WorkbookSourceSet =>
  takeoffSource({
    bills: [sourceBill("bill-1", "Bill No. 1")],
    rows: [first, sourceRow({ id: "row-b", sort: 1, qty: "120.00", rate: "1200.00", amount: "144000.00" }), third, ROW_D],
    geometries: [sourceGeometry("geo-a", "row-a", true)],
  });

export const asSaved = (): WorkbookSourceSet =>
  withRows(sourceRow({ id: "row-a", sort: 0, qty: "44.00", rate: "5000.00", amount: "220000.00" }), ROW_C);

export const afterRemeasure = (): WorkbookSourceSet =>
  withRows(sourceRow({ id: "row-a", sort: 0, qty: "52.00", rate: "5000.00", amount: "260000.00" }), {
    ...ROW_C,
    deleted_at: new Date("2026-02-01T00:00:00Z"),
  });

/** The workbook row the database would be holding, built from the bill AS IT WAS. */
export function storedAt(source: WorkbookSourceSet): PreconWorkbookRow {
  const user = userDocument();
  const layout = withScratchSheets(
    buildGeneratedLayout(source),
    user.sheetOrder,
    (sheetId) => user.sheets[sheetId]?.name ?? sheetId,
  );
  return {
    session_id: source.sessionId,
    snapshot: hydrateWorkbook({
      workbookId: workbookIdFor(source.sessionId),
      workbookName: user.name,
      layout,
      rows: liveRowsById(source),
      user,
    }),
    layout,
    version: 1,
    engine_version: "univer-oss-1.0.0",
    source_fingerprint: "fingerprint-as-saved",
    updated_by: "usr_qs",
    created_at: new Date("2026-02-01T00:00:00Z"),
    updated_at: new Date("2026-02-01T00:00:00Z"),
  };
}

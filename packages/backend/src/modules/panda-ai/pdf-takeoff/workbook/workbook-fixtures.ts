// Candidate workbooks for the engine tests.
//
// `takeoffCandidate` is the feasibility report's own fixture, cell for cell, so
// the figures the tests assert — 44 and 220000 before a remeasure, 52 and
// 260000 after — are the numbers that report published rather than numbers
// invented to match whatever the code happens to do.
//
// These are CANDIDATES: untrusted documents shaped the way a client sends one,
// not `WorkbookSnapshot`s. Validation is what turns one into the other, so a
// test that skipped it would be testing a different contract.

export type CandidateCell = { v?: string | number | boolean | null; f?: string; s?: string; t?: number };

export interface CandidateSheet {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  cellData: Record<number, Record<number, CandidateCell>>;
}

export interface CandidateWorkbook {
  id: string;
  name: string;
  sheetOrder: string[];
  sheets: Record<string, CandidateSheet>;
}

/**
 * Two sheets, one dependency chain, and the four formula kinds a bill of
 * quantities actually uses: arithmetic, SUM over a range, ROUND, and IF.
 *
 * @param grossLength the measured figure a remeasure would change. 24 gives a
 *   net quantity of 44 and an amount of 220000; 28 gives 52 and 260000.
 */
export function takeoffCandidate(grossLength: number, id = "wb-takeoff"): CandidateWorkbook {
  return {
    id,
    name: "Takeoff workbook",
    sheetOrder: ["takeoff", "summary"],
    sheets: {
      takeoff: {
        id: "takeoff",
        name: "Takeoff",
        rowCount: 40,
        columnCount: 10,
        cellData: {
          0: { 0: { v: "Item" }, 1: { v: "Value" } },
          1: { 0: { v: "Gross length" }, 1: { v: grossLength } },
          2: { 0: { v: "Deduction" }, 1: { v: 2 } },
          3: { 0: { v: "Count" }, 1: { v: 2 } },
          4: { 0: { v: "Net qty" }, 1: { f: "=(B2-B3)*B4" } },
          6: { 0: { v: "p1" }, 1: { v: 10 } },
          7: { 0: { v: "p2" }, 1: { v: 20 } },
          8: { 0: { v: "p3" }, 1: { v: 30 } },
          9: { 0: { v: "Sum" }, 1: { f: "=SUM(B7:B9)" } },
        },
      },
      summary: {
        id: "summary",
        name: "Summary",
        rowCount: 40,
        columnCount: 10,
        cellData: {
          0: { 0: { v: "Qty" }, 1: { f: "=Takeoff!B5" } },
          1: { 0: { v: "Rate" }, 1: { v: 5000 } },
          2: { 0: { v: "Amount" }, 1: { f: "=B1*B2" } },
          3: { 0: { v: "Rounded k" }, 1: { f: "=ROUND(B3/1000,1)" } },
          4: { 0: { v: "Status" }, 1: { f: '=IF(B3>100000,"OVER","UNDER")' } },
        },
      },
    },
  };
}

export type CycleShape = "self" | "mutual" | "cross-sheet";

/** A workbook whose only defect is one circular reference of the named shape. */
export function cyclicCandidate(shape: CycleShape, id = "wb-cyclic"): CandidateWorkbook {
  const candidate = takeoffCandidate(24, id);
  const takeoff = candidate.sheets.takeoff;
  const summary = candidate.sheets.summary;
  if (takeoff === undefined || summary === undefined) throw new Error("fixture lost a worksheet");

  if (shape === "self") {
    takeoff.cellData[11] = { 1: { f: "=B12+1" } };
  } else if (shape === "mutual") {
    takeoff.cellData[11] = { 1: { f: "=B13+1" } };
    takeoff.cellData[12] = { 1: { f: "=B12+1" } };
  } else {
    takeoff.cellData[11] = { 1: { f: "=Summary!B10" } };
    summary.cellData[9] = { 1: { f: "=Takeoff!B12" } };
  }
  return candidate;
}

/**
 * An acyclic control: a chain, a diamond and a range SUM over the same cells.
 * It exists so "the gate rejected it" can never be the trivially correct answer.
 */
export function diamondCandidate(id = "wb-diamond"): CandidateWorkbook {
  return {
    id,
    name: "Diamond",
    sheetOrder: ["s1"],
    sheets: {
      s1: {
        id: "s1",
        name: "S1",
        rowCount: 20,
        columnCount: 10,
        cellData: {
          0: { 0: { v: 10 }, 1: { f: "=A1*2" }, 2: { f: "=A1+5" }, 3: { f: "=B1+C1" }, 4: { f: "=SUM(A1:D1)" } },
          1: { 0: { f: "=D1*2" }, 1: { f: "=A2+E1" } },
        },
      },
    },
  };
}

const ROWS = 1000;

/**
 * The regression fixture: 1000 priced rows, 4005 populated cells.
 *
 * Every figure is an exact integer by construction — `ROUND(qty * 100 * 1.2, 2)`
 * is `qty * 120` with no half-cent tie anywhere — so a drifting result is a
 * real defect rather than a floating-point argument.
 */
export function pricedRowsCandidate(id = "wb-priced"): CandidateWorkbook {
  const takeoff: Record<number, Record<number, CandidateCell>> = {
    0: { 0: { v: "Qty" }, 1: { v: "Rate" }, 2: { v: "Amount" }, 3: { v: "With overhead" } },
  };
  for (let row = 1; row <= ROWS; row++) {
    const line = row + 1;
    takeoff[row] = {
      0: { v: row },
      1: { v: 100 },
      2: { f: `=A${line}*B${line}` },
      3: { f: `=ROUND(C${line}*1.2,2)` },
    };
  }

  return {
    id,
    name: "Priced rows",
    sheetOrder: ["takeoff", "summary"],
    sheets: {
      takeoff: { id: "takeoff", name: "Takeoff", rowCount: ROWS + 10, columnCount: 10, cellData: takeoff },
      summary: {
        id: "summary",
        name: "Summary",
        rowCount: 10,
        columnCount: 10,
        cellData: {
          0: { 0: { v: "Total" }, 1: { f: `=SUM(Takeoff!D2:D${ROWS + 1})` } },
          1: { 0: { v: "Rows" }, 1: { f: `=SUM(Takeoff!A2:A${ROWS + 1})` } },
        },
      },
    },
  };
}

/** Sum of `ROUND(qty * 100 * 1.2, 2)` for qty 1..1000, computed independently. */
export const PRICED_ROWS_TOTAL = 120 * ((ROWS * (ROWS + 1)) / 2);
export const PRICED_ROWS_QTY_TOTAL = (ROWS * (ROWS + 1)) / 2;
export const PRICED_ROWS_CELL_COUNT = ROWS * 4 + 4 + 4;

// The QA take-off, in the shape the live API actually returned it.
//
// Copied from a real `GET /precon/sessions/:id/workbook`, including the details
// that caused real refusals: generated formula cells carry `{f}` and NO cached
// `v`, literals carry `t: 1` for text and `t: 2` for numbers, and an unpriced
// line simply has no rate or amount cell at all. Shared by every workbook suite
// so they all describe the same document the server really serves.

import type { RawWorkbookData } from "./snapshot-io";
import type { WorkbookDocument } from "@/api/workbook-types";

export const BILL = "wb-bill-pcb_1";
export const SUMMARY = "wb-summary";

/** The QA take-off: two priced lines, one unpriced line, one withdrawn slot. */
export function document(): WorkbookDocument {
  return {
    sessionId: "pcs_qa",
    version: 3,
    engineVersion: "univer-oss-1.0.0",
    sourceFingerprint: "f".repeat(64),
    updatedAt: "2026-09-23T10:00:00.000Z",
    updatedBy: "usr_a",
    values: {},
    errors: [],
    reviewRollup: {
      boundRows: 3,
      verified: 1,
      needsReview: 2,
      unreviewed: 0,
      withdrawn: 1,
      missingBasis: 0,
      stated: 0,
      sourcesMoved: false,
    },
    history: [],
    layout: {
      schemaVersion: 1,
      sheets: [
        {
          sheetId: SUMMARY,
          kind: "summary",
          billId: null,
          name: "Summary",
          label: "Summary",
          firstBodyRow: 2,
          freeColumnStart: 2,
          columns: { "0": "label", "1": "amount" },
          bindings: [],
          billSlots: [{ billId: "pcb_1", gridRow: 2, label: "Bill No. 1", state: "bound" }],
        },
        {
          sheetId: BILL,
          kind: "bill",
          billId: "pcb_1",
          name: "Bill No. 1",
          label: "Bill No. 1",
          firstBodyRow: 1,
          freeColumnStart: 6,
          columns: { "0": "code", "1": "description", "2": "unit", "3": "qty", "4": "rate", "5": "amount" },
          bindings: [
            {
              rowId: "pbr_a",
              rowVersion: 7,
              gridRow: 1,
              state: "bound",
              basis: "measured",
              remeasurable: true,
              geometryIds: ["pgeo_a"],
              sourceSheetIds: ["pcsh_1"],
              revision: 1,
            },
            {
              rowId: "pbr_b",
              rowVersion: 4,
              gridRow: 2,
              state: "bound",
              basis: "stated",
              remeasurable: false,
              geometryIds: [],
              sourceSheetIds: [],
              revision: 1,
            },
            {
              rowId: "pbr_gone",
              rowVersion: 2,
              gridRow: 3,
              state: "withdrawn",
              basis: "measured",
              remeasurable: false,
              geometryIds: [],
              sourceSheetIds: [],
              revision: 1,
            },
          ],
        },
        {
          sheetId: "scratch-1",
          kind: "scratch",
          billId: null,
          name: "Working",
          label: "Working",
          firstBodyRow: 0,
          freeColumnStart: 0,
          columns: {},
          bindings: [],
        },
      ],
    },
    snapshot: {
      id: "wb-pcs_qa",
      name: "Takeoff workbook",
      sheetOrder: [SUMMARY, BILL, "scratch-1"],
      styles: {},
      sheets: {
        [SUMMARY]: {
          id: SUMMARY,
          name: "Summary",
          rowCount: 53,
          columnCount: 10,
          cellData: {
            "0": { "0": { v: "Measured total", t: 1 }, "1": { f: "=SUM(B3:B3)" } },
            "1": { "0": { v: "Bill", t: 1 }, "1": { v: "Amount", t: 1 } },
            "2": { "0": { v: "Bill No. 1", t: 1 }, "1": { f: "=SUM('Bill No. 1'!F2:F3)" } },
          },
        },
        [BILL]: {
          id: BILL,
          name: "Bill No. 1",
          rowCount: 58,
          columnCount: 14,
          cellData: {
            "0": {
              "0": { v: "Code", t: 1 },
              "1": { v: "Description", t: 1 },
              "2": { v: "Unit", t: 1 },
              "3": { v: "Qty", t: 1 },
              "4": { v: "Rate", t: 1 },
              "5": { v: "Amount", t: 1 },
            },
            "1": {
              "0": { v: "", t: 1 },
              "1": { v: "QA rectangle 24m2", t: 1 },
              "2": { v: "m2", t: 1 },
              "3": { v: 24, t: 2 },
              "4": { v: 5000, t: 2 },
              "5": { v: 120000, t: 2 },
            },
            // No rate, no amount: an unpriced line, exactly as hydrate renders it.
            "2": { "0": { v: "", t: 1 }, "1": { v: "QA five markers", t: 1 }, "2": { v: "nr", t: 1 }, "3": { v: 5, t: 2 } },
            "3": {
              "0": { f: "=#REF!" },
              "1": { f: "=#REF!" },
              "2": { f: "=#REF!" },
              "3": { f: "=#REF!" },
              "4": { f: "=#REF!" },
              "5": { f: "=#REF!" },
            },
          },
        },
        "scratch-1": { id: "scratch-1", name: "Working", rowCount: 40, columnCount: 12, cellData: {} },
      },
    },
  };
}

/** What Univer's `save()` gives back for an untouched document: cached values and all. */
export function rawFrom(doc: WorkbookDocument): RawWorkbookData {
  const sheets: Record<string, unknown> = {};
  for (const sheetId of doc.snapshot.sheetOrder) {
    const sheet = doc.snapshot.sheets[sheetId]!;
    const cellData: Record<string, Record<string, unknown>> = {};
    for (const [row, line] of Object.entries(sheet.cellData)) {
      cellData[row] = {};
      for (const [column, cell] of Object.entries(line)) {
        // The vendor round trip: a formula cell comes back with the figure it
        // last calculated, and every cell gains fields the API refuses.
        cellData[row]![column] = cell.f !== undefined ? { f: cell.f, v: 99, t: 2, si: null, custom: null } : { ...cell };
      }
    }
    sheets[sheetId] = {
      id: sheet.id,
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      cellData,
      // Vendor extras that must never reach the wire.
      freezeRow: 1,
      defaultColumnWidth: 104,
    };
  }
  return { id: doc.snapshot.id, name: doc.snapshot.name, sheetOrder: [...doc.snapshot.sheetOrder], sheets, styles: {} };
}

export function setCell(raw: RawWorkbookData, sheetId: string, row: number, column: number, cell: unknown): RawWorkbookData {
  const sheets = raw.sheets as Record<string, { cellData: Record<string, Record<string, unknown>> }>;
  const data = sheets[sheetId]!.cellData;
  data[String(row)] = { ...(data[String(row)] ?? {}), [String(column)]: cell };
  return raw;
}


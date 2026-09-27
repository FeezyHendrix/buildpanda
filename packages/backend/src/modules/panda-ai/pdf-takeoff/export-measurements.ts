import type ExcelJS from "exceljs";
import { grossOf } from "./export-formulas.ts";
import type { GeometryKind, PreconBoqRowDto, PreconGeometry, PreconSnapshot } from "./types.ts";

// Every priced line, with where and how it was measured: the sheet, the
// tool, the drawn figure and the basis sentence. This is the audit trail a
// QS checks a bill against, so it travels with the bill.

const TOOL_BY_KIND: Record<GeometryKind, string> = { linear: "length", area: "area", count: "count", deduction: "deduction" };

const MEASUREMENT_COLUMNS = [
  { header: "SHEET", width: 12 },
  { header: "BILL", width: 28 },
  { header: "CODE", width: 10 },
  { header: "DESCRIPTION", width: 48 },
  { header: "TOOL", width: 10 },
  { header: "GROSS", width: 10 },
  { header: "UNIT", width: 7 },
  { header: "BASIS", width: 70 },
  { header: "ORIGIN", width: 9 },
  { header: "STATUS", width: 12 },
];

export interface MeasurementLine {
  sheet: string;
  bill: string;
  code: string | null;
  description: string;
  tool: string;
  gross: number | null;
  unit: string | null;
  basis: string;
  origin: string;
  status: string;
}

/** The tool a line was measured with: the shape's kind, or "stated" when it was typed rather than drawn. */
export function toolOf(row: PreconBoqRowDto, geometry: PreconGeometry | undefined): string {
  if (!geometry) return "stated";
  // the basis names the factor a tool applied ("× 2.7 m height"), which is
  // how a wall-area line differs from the polyline it was drawn as
  const basis = row.measurementBasis?.toLowerCase() ?? "";
  if (geometry.kind === "linear" && basis.includes("m height")) return "wall area";
  if (geometry.kind === "linear" && basis.includes("polyline")) return "polyline";
  if (geometry.kind === "area" && basis.includes("m depth")) return "volume";
  return TOOL_BY_KIND[geometry.kind];
}

export function measurementLines(snapshot: PreconSnapshot): MeasurementLine[] {
  const sheetCode = new Map(snapshot.sheets.map((s) => [s.id, s.code ?? s.title ?? s.fileName]));
  const billTitle = new Map(snapshot.bills.map((b) => [b.id, b.title]));
  // the first measured shape for a line is its measurement; deduction shapes are openings taken off it
  const firstGeometry = new Map<string, PreconGeometry>();
  for (const g of snapshot.geometries) if (g.kind !== "deduction" && !firstGeometry.has(g.rowId)) firstGeometry.set(g.rowId, g);
  return snapshot.rows
    .filter((r) => (r.rowType === "item" || r.rowType === "provisional_sum") && r.status !== "rejected")
    .map((row) => {
      const geometry = firstGeometry.get(row.id);
      return {
        sheet: geometry ? (sheetCode.get(geometry.sheetId) ?? "—") : "—",
        bill: billTitle.get(row.billId) ?? "",
        code: row.code,
        description: row.description,
        tool: toolOf(row, geometry),
        gross: grossOf(row),
        unit: row.unit,
        basis: row.measurementBasis ?? "",
        origin: row.origin,
        status: row.status ?? "",
      };
    });
}

export function addMeasurementsSheet(workbook: ExcelJS.Workbook, snapshot: PreconSnapshot): void {
  const sheet = workbook.addWorksheet("Measurements", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = MEASUREMENT_COLUMNS.map(({ width }) => ({ width }));
  const header = sheet.addRow(MEASUREMENT_COLUMNS.map((c) => c.header));
  header.font = { bold: true, size: 10 };
  header.eachCell((cell) => {
    cell.border = { bottom: { style: "medium" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  });
  for (const line of measurementLines(snapshot)) {
    const r = sheet.addRow([line.sheet, line.bill, line.code, line.description, line.tool, line.gross, line.unit, line.basis, line.origin, line.status]);
    r.font = { size: 9 };
    r.getCell(6).numFmt = "#,##0.00";
    r.getCell(6).alignment = { horizontal: "right" };
    r.getCell(8).alignment = { wrapText: true };
  }
}

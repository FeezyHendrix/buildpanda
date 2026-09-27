import type { PreconBoqRowDto, PreconSnapshot } from "./types.ts";

// A bill as a spreadsheet import: one row per priced line and note, gross and
// deductions shown beside the net so the arithmetic can be checked, and the
// sheet each line was measured on. RFC 4180 quoting, CRLF rows, UTF-8 BOM so
// Excel reads the ₦ and m² characters.

export const CSV_COLUMNS = [
  "bill",
  "section",
  "code",
  "description",
  "unit",
  "gross",
  "deductions",
  "net",
  "rate",
  "amount",
  "sheet",
  "origin",
  "status",
  "basis",
] as const;

const BOM = "\uFEFF";

export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? String(value) : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csvRow = (cells: (string | number | null | undefined)[]): string => cells.map(csvField).join(",");

function deductionTotal(row: PreconBoqRowDto): number | null {
  if (row.deductions.length === 0) return null;
  return Math.round(row.deductions.reduce((sum, d) => sum + d.qty, 0) * 100) / 100;
}

export function buildTakeoffCsv(snapshot: PreconSnapshot): string {
  const billTitle = new Map(snapshot.bills.map((b) => [b.id, b.title]));
  const sheetCode = new Map(snapshot.sheets.map((s) => [s.id, s.code ?? s.title ?? s.fileName]));
  const sheetsByRow = new Map<string, Set<string>>();
  for (const g of snapshot.geometries) {
    if (g.kind === "deduction") continue;
    const code = sheetCode.get(g.sheetId);
    if (!code) continue;
    const set = sheetsByRow.get(g.rowId) ?? new Set<string>();
    set.add(code);
    sheetsByRow.set(g.rowId, set);
  }

  const lines: string[] = [csvRow([...CSV_COLUMNS])];
  const rows = [...snapshot.rows].sort((a, b) => a.billId.localeCompare(b.billId) || a.sort - b.sort);
  let currentBill: string | null = null;
  let section: string | null = null;
  for (const row of rows) {
    if (row.billId !== currentBill) {
      currentBill = row.billId;
      section = null;
    }
    if (row.rowType === "heading" || row.rowType === "work_section") {
      section = row.description;
      continue;
    }
    if (row.status === "rejected") continue;
    const priced = row.rowType !== "spec_note";
    lines.push(
      csvRow([
        billTitle.get(row.billId) ?? row.billId,
        section,
        row.code,
        row.rowType === "provisional_sum" ? `${row.description} (Provisional)` : row.description,
        priced ? row.unit : null,
        priced ? row.qtyGross : null,
        priced ? deductionTotal(row) : null,
        priced ? row.qty : null,
        priced ? row.rate : null,
        priced ? row.amount : null,
        [...(sheetsByRow.get(row.id) ?? [])].join("; ") || null,
        row.origin,
        row.status,
        row.measurementBasis,
      ]),
    );
  }
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

export function csvFileName(title: string): string {
  const safe = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "session";
  return `${safe}-takeoff.csv`;
}

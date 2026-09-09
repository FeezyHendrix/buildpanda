import ExcelJS from "exceljs";
import { COL, cellRef, deductionsOf, formula, grossOf, round2, sheetRef, sumRefs, typicalOf } from "./export-formulas.ts";
import { addMeasurementsSheet } from "./export-measurements.ts";
import type { PreconBill, PreconBoqRowDto, PreconSnapshot, PreconSummary } from "./types.ts";

// Workbook presentation follows the house QS example (Moniepoint bill):
// bold bordered column headers, uppercase bold element headings with breathing
// room, italic preambles/spec notes, S/N lettering restarting per bill,
// bordered CARRIED TO SUMMARY rows and a double-ruled grand total. Every
// derived figure is a live formula: net = (gross − deductions) × typical,
// amount = net × rate, subtotals and totals are SUMs, the summary references
// each bill's total cell.

const SN_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MONEY = "#,##0.00";
const QTY = "#,##0.00";

const COLUMNS = [
  { header: "S/N", key: "sn", width: 6 },
  { header: "DESCRIPTION OF ITEM", key: "description", width: 56 },
  { header: "GROSS", key: "gross", width: 10 },
  { header: "DEDUCT", key: "deduct", width: 10 },
  { header: "TYPICAL", key: "typical", width: 9 },
  { header: "QTY", key: "qty", width: 10 },
  { header: "UNIT", key: "unit", width: 7 },
  { header: "U/PRICE (₦)", key: "rate", width: 13 },
  { header: "AMOUNT (₦)", key: "amount", width: 16 },
];

interface BillTotal {
  title: string;
  total: number;
  // the bill sheet's total cell, for the summary to reference
  totalRef: string;
}

function addHeaderRow(sheet: ExcelJS.Worksheet): void {
  const row = sheet.addRow(COLUMNS.map((c) => c.header));
  row.font = { bold: true, size: 10 };
  row.eachCell((cell) => {
    cell.border = { bottom: { style: "medium" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  });
  sheet.addRow([]);
}

function styleNumberCells(row: ExcelJS.Row): void {
  for (const col of [COL.gross, COL.deduct, COL.typical, COL.qty]) {
    row.getCell(col).numFmt = QTY;
    row.getCell(col).alignment = { horizontal: "right" };
  }
  row.getCell(COL.unit).alignment = { horizontal: "center" };
  for (const col of [COL.rate, COL.amount]) {
    row.getCell(col).numFmt = MONEY;
    row.getCell(col).alignment = { horizontal: "right" };
  }
}

function addItemRow(sheet: ExcelJS.Worksheet, sn: string, row: PreconBoqRowDto): { rowNumber: number; amount: number } {
  const isProvisional = row.rowType === "provisional_sum";
  const gross = grossOf(row);
  const deduct = deductionsOf(row);
  const typical = typicalOf(row);
  const net = row.qty ?? round2(((gross ?? 0) - deduct) * typical);
  const amount = row.amount ?? (row.rate === null ? 0 : round2(net * row.rate));
  const r = sheet.addRow([sn, isProvisional ? `${row.description} (Provisional)` : row.description, gross, deduct, typical, null, row.unit, row.rate, null]);
  const n = r.number;
  r.getCell(COL.qty).value = formula(`(${cellRef(COL.gross, n)}-${cellRef(COL.deduct, n)})*${cellRef(COL.typical, n)}`, net);
  r.getCell(COL.amount).value = formula(`${cellRef(COL.qty, n)}*${cellRef(COL.rate, n)}`, amount);
  r.font = { size: 10, italic: isProvisional };
  r.getCell(COL.description).alignment = { wrapText: true };
  styleNumberCells(r);
  return { rowNumber: n, amount };
}

function billSheet(workbook: ExcelJS.Workbook, bill: PreconBill, rows: PreconBoqRowDto[]): BillTotal {
  const sheet = workbook.addWorksheet(bill.title.replace(/[[\]*?/\\:]/g, "").slice(0, 31), {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = COLUMNS.map(({ key, width }) => ({ key, width }));
  addHeaderRow(sheet);

  let letterIndex = 0;
  let total = 0;
  let firstElement = true;
  const elementRows = new Map<string, number[]>();
  const elementTotals = new Map<string, number>();

  for (const row of rows) {
    if (row.status === "rejected") continue;
    switch (row.rowType) {
      case "heading": {
        // element heading: breathing room above, larger bold uppercase
        if (!firstElement) sheet.addRow([]);
        firstElement = false;
        sheet.addRow([]);
        const r = sheet.addRow([null, row.description.toUpperCase()]);
        r.font = { bold: true, size: 12 };
        r.getCell(COL.description).border = { bottom: { style: "thin" } };
        break;
      }
      case "work_section": {
        sheet.addRow([]);
        const r = sheet.addRow([null, row.description]);
        r.font = { bold: true, size: 10 };
        break;
      }
      case "spec_note": {
        const r = sheet.addRow([null, row.description]);
        r.font = { italic: true, size: 9, color: { argb: "FF444444" } };
        r.getCell(COL.description).alignment = { wrapText: true };
        break;
      }
      case "item":
      case "provisional_sum": {
        const sn = SN_LETTERS[letterIndex % SN_LETTERS.length]!;
        letterIndex += 1;
        const { rowNumber, amount } = addItemRow(sheet, sn, row);
        total += amount;
        const key = row.elementGroup ?? "General";
        elementRows.set(key, [...(elementRows.get(key) ?? []), rowNumber]);
        elementTotals.set(key, (elementTotals.get(key) ?? 0) + amount);
        break;
      }
    }
  }

  sheet.addRow([]);
  const subtotalRows: number[] = [];
  for (const [element, rowNumbers] of elementRows) {
    const r = sheet.addRow([null, `${element.toUpperCase()} CARRIED TO SUMMARY`]);
    r.getCell(COL.amount).value = formula(sumRefs(COL.amount, rowNumbers), round2(elementTotals.get(element) ?? 0));
    r.font = { bold: true, size: 10 };
    r.getCell(COL.amount).numFmt = MONEY;
    r.getCell(COL.amount).border = { top: { style: "thin" } };
    subtotalRows.push(r.number);
  }
  const totalRow = sheet.addRow([null, `${bill.title.toUpperCase()} — TOTAL`]);
  totalRow.getCell(COL.amount).value = formula(sumRefs(COL.amount, subtotalRows), round2(total));
  totalRow.font = { bold: true, size: 11 };
  totalRow.getCell(COL.amount).numFmt = MONEY;
  totalRow.getCell(COL.amount).border = { top: { style: "medium" }, bottom: { style: "double" } };
  return { title: bill.title, total: round2(total), totalRef: sheetRef(sheet.name, cellRef(COL.amount, totalRow.number)) };
}

function summarySheet(
  workbook: ExcelJS.Workbook,
  billTotals: BillTotal[],
  summary: PreconSummary,
  settings: { prelimsPct: number; contingencyPct: number; vatPct: number },
): void {
  const sheet = workbook.addWorksheet("General Summary");
  sheet.columns = COLUMNS.map(({ key, width }) => ({ key, width }));
  addHeaderRow(sheet);

  const title = sheet.addRow([null, "GENERAL SUMMARY"]);
  title.font = { bold: true, size: 14 };
  sheet.addRow([]);

  const billRows: number[] = [];
  billTotals.forEach((bill, index) => {
    const r = sheet.addRow([String(index + 1), bill.title]);
    r.getCell(COL.amount).value = formula(bill.totalRef, bill.total);
    r.font = { size: 10 };
    r.getCell(COL.amount).numFmt = MONEY;
    billRows.push(r.number);
  });
  sheet.addRow([]);

  const measured = sumRefs(COL.amount, billRows);
  const amountAt = (rowNumber: number): string => cellRef(COL.amount, rowNumber);
  // each line's formula refers to the lines above it, so the row numbers are
  // resolved as the sheet is written
  const lines: { label: string; value: number; expression: (rows: number[]) => string; bold?: boolean; topBorder?: boolean }[] = [
    { label: `PRELIMINARIES (${settings.prelimsPct}% of measured works)`, value: summary.prelims, expression: () => `ROUND(${measured}*${settings.prelimsPct}/100,2)` },
    { label: "SUB-TOTAL I (CONSTRUCTION SUM)", value: summary.constructionSum, expression: (rows) => `${measured}+${amountAt(rows[0]!)}`, bold: true, topBorder: true },
    { label: `CONTINGENCIES (${settings.contingencyPct}% of Construction Sum)`, value: summary.contingency, expression: (rows) => `ROUND(${amountAt(rows[1]!)}*${settings.contingencyPct}/100,2)` },
    { label: "SUB-TOTAL II", value: summary.subTotal, expression: (rows) => `${amountAt(rows[1]!)}+${amountAt(rows[2]!)}`, bold: true, topBorder: true },
    { label: `ADD VAT (${settings.vatPct}% OF SUB-TOTAL II)`, value: summary.vat, expression: (rows) => `ROUND(${amountAt(rows[3]!)}*${settings.vatPct}/100,2)` },
  ];
  const written: number[] = [];
  for (const line of lines) {
    const r = sheet.addRow([null, line.label]);
    r.getCell(COL.amount).value = formula(line.expression(written), line.value);
    r.font = { bold: Boolean(line.bold), size: 10 };
    r.getCell(COL.amount).numFmt = MONEY;
    if (line.topBorder) r.getCell(COL.amount).border = { top: { style: "thin" } };
    written.push(r.number);
  }
  sheet.addRow([]);
  const grand = sheet.addRow([null, "GRAND TOTAL"]);
  grand.getCell(COL.amount).value = formula(`${amountAt(written[3]!)}+${amountAt(written[4]!)}`, summary.grandTotal);
  grand.font = { bold: true, size: 13 };
  grand.getCell(COL.amount).numFmt = MONEY;
  grand.getCell(COL.amount).border = { top: { style: "medium" }, bottom: { style: "double" } };
}

export async function buildBoqWorkbookBuffer(snapshot: PreconSnapshot, projectName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BuildPanda";
  // the cached results are the app's figures; ask Excel to recalculate on open
  // so an edited cell flows through every formula immediately
  workbook.calcProperties.fullCalcOnLoad = true;

  const cover = workbook.addWorksheet("Cover Page");
  cover.columns = [{ width: 8 }, { width: 70 }];
  cover.addRow([]);
  cover.addRow([]);
  cover.addRow([null, projectName.toUpperCase()]).font = { bold: true, size: 18 };
  cover.addRow([]);
  cover.addRow([null, "BILL OF QUANTITIES"]).font = { bold: true, size: 14 };
  cover.addRow([null, snapshot.session.title]).font = { size: 11 };
  cover.addRow([]);
  cover.addRow([null, `Draft grand total: ₦${snapshot.summary.grandTotal.toLocaleString("en-NG")}`]).font = { size: 11 };
  cover
    .addRow([null, `Review progress: ${snapshot.progress.verified} of ${snapshot.progress.total} items verified`])
    .font = { size: 10 };
  const measuredBy = snapshot.session.takeoffKind === "manual" ? "Measured by hand" : "Measured by Panda AI";
  cover.addRow([null, `${measuredBy} — quantities and amounts are live formulas; figures become contractual only after QS sign-off.`]).font = {
    italic: true,
    size: 9,
    color: { argb: "FF666666" },
  };

  const rowsByBill = new Map<string, PreconBoqRowDto[]>();
  for (const row of snapshot.rows) {
    const list = rowsByBill.get(row.billId);
    if (list) list.push(row);
    else rowsByBill.set(row.billId, [row]);
  }

  const billTotals: BillTotal[] = [];
  for (const bill of snapshot.bills) {
    billTotals.push(billSheet(workbook, bill, rowsByBill.get(bill.id) ?? []));
  }
  summarySheet(workbook, billTotals, snapshot.summary, snapshot.settings);
  addMeasurementsSheet(workbook, snapshot);

  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data as ArrayBuffer);
}

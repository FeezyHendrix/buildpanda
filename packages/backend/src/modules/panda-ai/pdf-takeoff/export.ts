import ExcelJS from "exceljs";
import type { PreconBill, PreconBoqRowDto, PreconSnapshot, PreconSummary } from "./types.ts";

// Workbook presentation follows the house QS example (Moniepoint bill):
// bold bordered column headers, uppercase bold element headings with breathing
// room, italic preambles/spec notes, S/N lettering restarting per bill,
// bordered CARRIED TO SUMMARY rows and a double-ruled grand total.

const SN_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MONEY = "#,##0.00";

const COLUMNS = [
  { header: "S/N", key: "sn", width: 6 },
  { header: "DESCRIPTION OF ITEM", key: "description", width: 64 },
  { header: "QTY", key: "qty", width: 10 },
  { header: "UNIT", key: "unit", width: 7 },
  { header: "U/PRICE (₦)", key: "rate", width: 13 },
  { header: "AMOUNT (₦)", key: "amount", width: 16 },
];

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
  row.getCell(3).numFmt = MONEY;
  row.getCell(5).numFmt = MONEY;
  row.getCell(6).numFmt = MONEY;
  row.getCell(3).alignment = { horizontal: "right" };
  row.getCell(4).alignment = { horizontal: "center" };
  row.getCell(5).alignment = { horizontal: "right" };
  row.getCell(6).alignment = { horizontal: "right" };
}

function billSheet(workbook: ExcelJS.Workbook, bill: PreconBill, rows: PreconBoqRowDto[]): { total: number } {
  const sheet = workbook.addWorksheet(bill.title.replace(/[[\]*?/\\:]/g, "").slice(0, 31), {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = COLUMNS.map(({ key, width }) => ({ key, width }));
  addHeaderRow(sheet);

  let letterIndex = 0;
  let total = 0;
  let firstElement = true;
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
        r.getCell(2).border = { bottom: { style: "thin" } };
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
        r.getCell(2).alignment = { wrapText: true };
        break;
      }
      case "item":
      case "provisional_sum": {
        const sn = SN_LETTERS[letterIndex % SN_LETTERS.length]!;
        letterIndex += 1;
        const isProvisional = row.rowType === "provisional_sum";
        const r = sheet.addRow([
          sn,
          isProvisional ? `${row.description} (Provisional)` : row.description,
          row.qty,
          row.unit,
          row.rate,
          row.amount,
        ]);
        r.font = { size: 10, italic: isProvisional };
        r.getCell(2).alignment = { wrapText: true };
        styleNumberCells(r);
        if (row.amount !== null) {
          total += row.amount;
          const key = row.elementGroup ?? "General";
          elementTotals.set(key, (elementTotals.get(key) ?? 0) + row.amount);
        }
        break;
      }
    }
  }

  sheet.addRow([]);
  for (const [element, elementTotal] of elementTotals) {
    const r = sheet.addRow([
      null,
      `${element.toUpperCase()} CARRIED TO SUMMARY`,
      null,
      null,
      null,
      Math.round(elementTotal * 100) / 100,
    ]);
    r.font = { bold: true, size: 10 };
    r.getCell(6).numFmt = MONEY;
    r.getCell(6).border = { top: { style: "thin" } };
  }
  const totalRow = sheet.addRow([null, `${bill.title.toUpperCase()} — TOTAL`, null, null, null, Math.round(total * 100) / 100]);
  totalRow.font = { bold: true, size: 11 };
  totalRow.getCell(6).numFmt = MONEY;
  totalRow.getCell(6).border = { top: { style: "medium" }, bottom: { style: "double" } };
  return { total: Math.round(total * 100) / 100 };
}

function summarySheet(
  workbook: ExcelJS.Workbook,
  billTotals: { title: string; total: number }[],
  summary: PreconSummary,
  settings: { prelimsPct: number; contingencyPct: number; vatPct: number },
): void {
  const sheet = workbook.addWorksheet("General Summary");
  sheet.columns = COLUMNS.map(({ key, width }) => ({ key, width }));
  addHeaderRow(sheet);

  const title = sheet.addRow([null, "GENERAL SUMMARY"]);
  title.font = { bold: true, size: 14 };
  sheet.addRow([]);

  billTotals.forEach((bill, index) => {
    const r = sheet.addRow([String(index + 1), bill.title, null, null, null, bill.total]);
    r.font = { size: 10 };
    r.getCell(6).numFmt = MONEY;
  });
  sheet.addRow([]);

  const lines: { label: string; value: number; bold?: boolean; topBorder?: boolean }[] = [
    { label: `PRELIMINARIES (${settings.prelimsPct}% of measured works)`, value: summary.prelims },
    { label: "SUB-TOTAL I (CONSTRUCTION SUM)", value: summary.constructionSum, bold: true, topBorder: true },
    { label: `CONTINGENCIES (${settings.contingencyPct}% of Construction Sum)`, value: summary.contingency },
    { label: "SUB-TOTAL II", value: summary.subTotal, bold: true, topBorder: true },
    { label: `ADD VAT (${settings.vatPct}% OF SUB-TOTAL II)`, value: summary.vat },
  ];
  for (const line of lines) {
    const r = sheet.addRow([null, line.label, null, null, null, line.value]);
    r.font = { bold: Boolean(line.bold), size: 10 };
    r.getCell(6).numFmt = MONEY;
    if (line.topBorder) r.getCell(6).border = { top: { style: "thin" } };
  }
  sheet.addRow([]);
  const grand = sheet.addRow([null, "GRAND TOTAL", null, null, null, summary.grandTotal]);
  grand.font = { bold: true, size: 13 };
  grand.getCell(6).numFmt = MONEY;
  grand.getCell(6).border = { top: { style: "medium" }, bottom: { style: "double" } };
}

export async function buildBoqWorkbookBuffer(snapshot: PreconSnapshot, projectName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BuildPanda";

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
  cover.addRow([null, "Measured by Panda AI — figures become contractual only after QS sign-off."]).font = {
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

  const billTotals: { title: string; total: number }[] = [];
  for (const bill of snapshot.bills) {
    const { total } = billSheet(workbook, bill, rowsByBill.get(bill.id) ?? []);
    billTotals.push({ title: bill.title, total });
  }
  summarySheet(workbook, billTotals, snapshot.summary, snapshot.settings);

  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data as ArrayBuffer);
}

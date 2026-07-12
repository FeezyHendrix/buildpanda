import * as XLSX from "xlsx";
import type { PreconBill, PreconBoqRowDto, PreconSnapshot, PreconSummary } from "./types.ts";

type Cell = string | number | null;

const HEADER: Cell[] = ["S/N", "DESCRIPTION OF ITEM", "QTY", "UNIT", "U/PRICE", "AMOUNT"];

// Bill pages letter items A, B, C… (skipping I and O per QS convention).
const SN_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function billRows(bill: PreconBill, rows: PreconBoqRowDto[]): { aoa: Cell[][]; total: number } {
  const aoa: Cell[][] = [HEADER, []];
  let letterIdx = 0;
  let total = 0;
  const elementTotals = new Map<string, number>();

  for (const row of rows) {
    if (row.status === "rejected") continue;
    switch (row.rowType) {
      case "heading":
        aoa.push([]);
        aoa.push([null, row.description]);
        break;
      case "work_section":
        aoa.push([]);
        aoa.push([null, row.description]);
        break;
      case "spec_note":
        aoa.push([null, row.description]);
        break;
      case "item":
      case "provisional_sum": {
        const sn = SN_LETTERS[letterIdx % SN_LETTERS.length]!;
        letterIdx += 1;
        aoa.push([sn, row.description, row.qty, row.unit, row.rate, row.amount]);
        if (row.amount !== null) {
          total += row.amount;
          const key = row.elementGroup ?? "General";
          elementTotals.set(key, (elementTotals.get(key) ?? 0) + row.amount);
        }
        break;
      }
    }
  }

  aoa.push([]);
  for (const [element, elementTotal] of elementTotals) {
    aoa.push([null, `${element.toUpperCase()} CARRIED TO SUMMARY`, null, null, null, Math.round(elementTotal * 100) / 100]);
  }
  aoa.push([null, `${bill.title} — TOTAL`, null, null, null, Math.round(total * 100) / 100]);
  return { aoa, total: Math.round(total * 100) / 100 };
}

function generalSummary(
  billTotals: { title: string; total: number }[],
  summary: PreconSummary,
  settings: { prelimsPct: number; contingencyPct: number; vatPct: number },
): Cell[][] {
  const aoa: Cell[][] = [HEADER, [], [null, "GENERAL SUMMARY"], []];
  billTotals.forEach((bill, index) => {
    aoa.push([String(index + 1), bill.title, null, null, null, bill.total]);
  });
  aoa.push([]);
  aoa.push([null, `PRELIMINARIES (${settings.prelimsPct}% of measured works)`, null, null, null, summary.prelims]);
  aoa.push([null, "SUB-TOTAL I (CONSTRUCTION SUM)", null, null, null, summary.constructionSum]);
  aoa.push([null, `CONTINGENCIES (${settings.contingencyPct}% of Construction Sum)`, null, null, null, summary.contingency]);
  aoa.push([null, "SUB-TOTAL II", null, null, null, summary.subTotal]);
  aoa.push([null, `ADD VAT (${settings.vatPct}% OF SUB-TOTAL II)`, null, null, null, summary.vat]);
  aoa.push([]);
  aoa.push([null, "GRAND TOTAL", null, null, null, summary.grandTotal]);
  return aoa;
}

export function buildBoqWorkbook(snapshot: PreconSnapshot, projectName: string): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  const cover: Cell[][] = [
    [],
    [null, projectName.toUpperCase()],
    [],
    [null, "BILL OF QUANTITIES"],
    [null, snapshot.session.title],
    [],
    [null, `Draft grand total: ${snapshot.summary.grandTotal.toLocaleString("en-NG")} NGN`],
    [null, `Review progress: ${snapshot.progress.verified} of ${snapshot.progress.total} items verified`],
    [null, "Measured by Panda AI - reviewed figures only become contractual once a QS signs off."],
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(cover), "Cover Page");

  const rowsByBill = new Map<string, PreconBoqRowDto[]>();
  for (const row of snapshot.rows) {
    const list = rowsByBill.get(row.billId);
    if (list) list.push(row);
    else rowsByBill.set(row.billId, [row]);
  }

  const billTotals: { title: string; total: number }[] = [];
  for (const bill of snapshot.bills) {
    const { aoa, total } = billRows(bill, rowsByBill.get(bill.id) ?? []);
    billTotals.push({ title: bill.title, total });
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    sheet["!cols"] = [{ wch: 5 }, { wch: 70 }, { wch: 9 }, { wch: 7 }, { wch: 12 }, { wch: 15 }];
    // sheet names cap at 31 chars in xlsx
    XLSX.utils.book_append_sheet(workbook, sheet, bill.title.replace(/[[\]*?/\\:]/g, "").slice(0, 31));
  }

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(generalSummary(billTotals, snapshot.summary, snapshot.settings)),
    "General Summary",
  );
  return workbook;
}

export function workbookBuffer(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

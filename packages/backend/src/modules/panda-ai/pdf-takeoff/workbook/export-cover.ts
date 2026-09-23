// The first page of an exported workbook: what this file is, and what it is
// not.
//
// A spreadsheet that leaves BuildPanda stops being version-controlled the
// moment it is emailed, so it has to carry its own provenance — which take-off,
// which workbook version, which measurements, and when. The source fingerprint
// is printed for the same reason a drawing carries a revision: two files that
// look alike can be answers to different questions, and only the fingerprint
// settles which.
//
// It also states plainly what the figures are worth. Review standing is
// reported, never conferred: exporting a workbook verifies nothing.

import type ExcelJS from "exceljs";
import type { WorkbookDocument } from "./types.ts";

export interface WorkbookExportMeta {
  readonly projectName: string | null;
  readonly sessionTitle: string;
  readonly generatedAt: Date;
}

const LABEL_WIDTH = 34;
const VALUE_WIDTH = 64;

function heading(sheet: ExcelJS.Worksheet, text: string, size: number): void {
  sheet.addRow([text]).font = { bold: true, size };
}

function entry(sheet: ExcelJS.Worksheet, label: string, value: string): void {
  const row = sheet.addRow([label, value]);
  row.getCell(1).font = { bold: true, size: 10 };
  row.getCell(2).font = { size: 10 };
  row.getCell(2).alignment = { wrapText: true };
}

function note(sheet: ExcelJS.Worksheet, text: string): void {
  const row = sheet.addRow([null, text]);
  row.getCell(2).font = { italic: true, size: 9, color: { argb: "FF666666" } };
  row.getCell(2).alignment = { wrapText: true };
}

export function addCoverSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  document: WorkbookDocument,
  meta: WorkbookExportMeta,
): void {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = [{ width: LABEL_WIDTH }, { width: VALUE_WIDTH }];

  heading(sheet, (meta.projectName ?? meta.sessionTitle).toUpperCase(), 16);
  heading(sheet, "TAKEOFF WORKBOOK", 12);
  sheet.addRow([]);

  entry(sheet, "Take-off", meta.sessionTitle);
  entry(sheet, "Workbook version", document.version === 0 ? "Not yet saved (first draft)" : String(document.version));
  entry(sheet, "Calculation engine", document.engineVersion);
  entry(sheet, "Exported", meta.generatedAt.toISOString());
  entry(sheet, "Last saved", document.updatedAt ?? "—");
  entry(sheet, "Measurement fingerprint", document.sourceFingerprint);
  sheet.addRow([]);

  const review = document.reviewRollup;
  heading(sheet, "REVIEW STANDING OF THE MEASUREMENTS", 11);
  entry(sheet, "Bound bill lines", String(review.boundRows));
  entry(sheet, "Verified", String(review.verified));
  entry(sheet, "Needs review", String(review.needsReview));
  entry(sheet, "Not yet reviewed", String(review.unreviewed));
  entry(sheet, "Withdrawn (shown as #REF!)", String(review.withdrawn));
  entry(sheet, "Drawn without a recorded basis", String(review.missingBasis));
  entry(sheet, "Priced with no annotation behind them", String(review.stated));
  entry(sheet, "Cells with no usable figure", String(document.errors.length));
  sheet.addRow([]);

  note(
    sheet,
    "Every figure in this file was recalculated from the take-off's current measurements at the moment of export; " +
      "no stored or cached figure was copied. Formulas are live, so editing a cell updates the ones that depend on it.",
  );
  note(
    sheet,
    "A cell showing #REF! stands for a measurement that has been withdrawn. It is not zero, and it must not be read as zero.",
  );
  note(
    sheet,
    "Quantities become contractual only after QS sign-off in BuildPanda. Editing this file changes nothing in the take-off, " +
      "and a total worked out on a scratch worksheet is not an estimate until it is explicitly applied to one.",
  );
}

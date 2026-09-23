// The three cell styles the workbook injects, and which cell gets which.
//
// Kept free of any `@univerjs` import so the serializer that applies them stays
// runnable under the plain node test runner — the vendor engine is a browser
// concern, but "does a measured cell come back looking generated" is not.
//
// Ids are FIXED. A generated name would add three more entries to the style
// table every time the workbook was opened, and the table is persisted.

import type { WorkbookSheetLayout } from "@/api/workbook-types";
import { isEditableCell, isProtected } from "./protected";

export const GENERATED_STYLE_ID = "bp-generated";
export const GENERATED_EDITABLE_STYLE_ID = "bp-generated-editable";
export const HEADER_STYLE_ID = "bp-heading";

/** DESIGN.md → semantic roles: `surface-alt`, `ink`, `ink-subtle`; Plus Jakarta Sans. */
export const WORKBOOK_STYLES: Readonly<Record<string, Record<string, unknown>>> = Object.freeze({
  [HEADER_STYLE_ID]: { bg: { rgb: "#F6F6F6" }, cl: { rgb: "#414141" }, bl: 1, ff: "Plus Jakarta Sans", fs: 11 },
  [GENERATED_STYLE_ID]: { bg: { rgb: "#FAFAFA" }, cl: { rgb: "#131B2E" }, ff: "Plus Jakarta Sans" },
  // A figure a person may move sits on white, like their own columns, so
  // "editable" reads without relying on colour alone.
  [GENERATED_EDITABLE_STYLE_ID]: { bg: { rgb: "#FFFFFF" }, cl: { rgb: "#131B2E" }, ff: "Plus Jakarta Sans" },
});

/**
 * The style a generated cell should wear, or `null` for a cell the workbook has
 * no opinion about. A cell the user already styled keeps what they chose.
 */
export function generatedStyleFor(sheet: WorkbookSheetLayout, row: number, column: number): string | null {
  if (!isProtected(sheet, column)) return null;
  if (row < sheet.firstBodyRow) return HEADER_STYLE_ID;
  return isEditableCell(sheet, row, column) ? GENERATED_EDITABLE_STYLE_ID : GENERATED_STYLE_ID;
}

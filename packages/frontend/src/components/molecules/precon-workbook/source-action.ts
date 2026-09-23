// What the workbook may offer to do about the figure under the cursor.
//
// The answer is the server's, not a guess from what the cell looks like.
// `binding.basis` records HOW the figure came to be, and each value permits a
// different act:
//
//   measured   an annotation exists and was recorded. Open it.
//   legacy     drawn before definitions were kept. There is nothing to reopen,
//              so it takes the existing basis-confirmation workflow.
//   stated     a priced line with no annotation at all. Offer to draw one.
//              NEVER invent an annotation to "reopen" — that would fabricate
//              evidence for a figure somebody typed.
//   narrative  a heading or spec note. It carries no quantity.
//
// A withdrawn line offers nothing: its bill line is gone, and the cell is a
// `#REF!` standing where a figure used to be.

import type { WorkbookBinding, WorkbookLayout, WorkbookSheetLayout } from "@/api/workbook-types";

export type SourceAction =
  | {
      readonly kind: "remeasure";
      readonly rowId: string;
      readonly label: string;
      /** More than one means a chooser: several annotations feed this figure. */
      readonly geometryIds: readonly string[];
      readonly sourceSheetIds: readonly string[];
      readonly revision: number;
    }
  | { readonly kind: "confirm-basis"; readonly rowId: string; readonly label: string }
  | { readonly kind: "draw"; readonly rowId: string; readonly label: string }
  | { readonly kind: "none"; readonly reason: string };

export interface FocusedBinding {
  readonly sheet: WorkbookSheetLayout;
  readonly binding: WorkbookBinding;
  /** The line's description as the grid currently shows it. */
  readonly label: string;
}

/** The bill line whose row the cursor is on, if the cursor is on one at all. */
export function bindingAt(
  layout: WorkbookLayout,
  sheetId: string | null,
  row: number,
  describe: (sheetId: string, row: number) => string,
): FocusedBinding | null {
  if (sheetId === null) return null;
  const sheet = layout.sheets.find((entry) => entry.sheetId === sheetId);
  if (!sheet || sheet.kind !== "bill") return null;
  const binding = sheet.bindings.find((entry) => entry.gridRow === row);
  if (!binding) return null;
  return { sheet, binding, label: describe(sheetId, row) || "this bill line" };
}

export function sourceActionFor(focused: FocusedBinding | null): SourceAction {
  if (focused === null) return { kind: "none", reason: "Select a bill line to see where its quantity came from." };
  const { binding, label } = focused;

  if (binding.state === "withdrawn") {
    return { kind: "none", reason: "This bill line has been withdrawn from the take-off." };
  }
  if (binding.basis === "narrative") {
    return { kind: "none", reason: "This line is a heading, so it carries no quantity." };
  }
  if (binding.basis === "measured") {
    return {
      kind: "remeasure",
      rowId: binding.rowId,
      label,
      geometryIds: binding.geometryIds,
      sourceSheetIds: binding.sourceSheetIds,
      revision: binding.revision,
    };
  }
  if (binding.basis === "legacy") return { kind: "confirm-basis", rowId: binding.rowId, label };
  return { kind: "draw", rowId: binding.rowId, label };
}

export const SOURCE_ACTION_LABELS: Readonly<Record<Exclude<SourceAction["kind"], "none">, string>> = {
  remeasure: "Remeasure",
  "confirm-basis": "Confirm basis",
  draw: "Draw measurement",
};

/** Whether opening this action needs the user to say WHICH annotation first. */
export function needsSourceChooser(action: SourceAction): boolean {
  return action.kind === "remeasure" && action.geometryIds.length > 1;
}

export const BASIS_LABELS: Readonly<Record<WorkbookBinding["basis"], string>> = {
  measured: "Measured",
  legacy: "No recorded basis",
  stated: "Entered by hand",
  narrative: "Heading",
};

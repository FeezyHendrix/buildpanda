import { useCallback, useState } from "react";
import { toast } from "@/lib/toast";
import type { SourceAction } from "@/components/molecules/precon-workbook";
import type { PreconGeometry, PreconSnapshot } from "@/api/precon";
import type { CollapsePreference, WorkspaceMode } from "./workspace-mode";

export interface SourceChoice {
  readonly rowId: string;
  readonly label: string;
  readonly geometries: readonly PreconGeometry[];
}

export interface SourceNavigation {
  /** Open when one figure has several annotations behind it and the user must pick. */
  choice: SourceChoice | null;
  closeChoice: () => void;
  open: (action: SourceAction) => void;
  chooseGeometry: (geometry: PreconGeometry) => void;
  /** "drawings" once a source action asked for one, so a too-narrow split shows that. */
  collapseTo: CollapsePreference;
  returnToWorkbook: () => void;
  /**
   * The annotation the person chose, for the viewer to put handles on. `seq`
   * carries by value so choosing the same shape twice is still a request.
   */
  focusGeometry: { seq: number; geometryId: string } | null;
}

interface Options {
  /** Undefined while the take-off is still loading; the hook must still run. */
  snapshot: PreconSnapshot | undefined;
  requestedMode: WorkspaceMode;
  selectSheet: (sheetId: string) => void;
  selectRow: (rowId: string | null, sheetId?: string | null) => void;
  setMode: (mode: WorkspaceMode) => void;
}

/**
 * Taking a person from a figure in the workbook to the annotation it came from.
 *
 * It opens the EXISTING annotation — the one whose id the server put in the
 * binding — and never draws a new one. That distinction is the whole point of
 * `basis`: a `stated` line has no annotation, and offering to "reopen" one
 * would fabricate evidence for a number somebody typed by hand.
 *
 * The mode is only widened, never narrowed: asking to see a drawing from a
 * split view leaves the split alone, because the workbook the user is reading
 * the figure in is half of why they asked.
 */
export function useSourceNavigation({
  snapshot,
  requestedMode,
  selectSheet,
  selectRow,
  setMode,
}: Options): SourceNavigation {
  const [choice, setChoice] = useState<SourceChoice | null>(null);
  const [collapseTo, setCollapseTo] = useState<CollapsePreference>("workbook");
  const [focusGeometry, setFocusGeometry] = useState<{ seq: number; geometryId: string } | null>(null);

  const reveal = useCallback(
    (rowId: string, sheetId: string | null, geometryId: string | null) => {
      setCollapseTo("drawings");
      // Cleared when the line is reached without naming a shape, so a previous
      // choice cannot leave handles on an annotation of a different row.
      setFocusGeometry(geometryId === null ? null : { seq: Date.now(), geometryId });
      if (requestedMode === "workbook") setMode("split");
      if (sheetId) selectSheet(sheetId);
      selectRow(rowId, sheetId ?? undefined);
    },
    [requestedMode, selectSheet, selectRow, setMode],
  );

  const open = useCallback(
    (action: SourceAction) => {
      if (action.kind === "none") return;

      if (action.kind === "draw") {
        reveal(action.rowId, null, null);
        toast(`Draw the measurement for "${action.label}" on the drawing.`, "info");
        return;
      }

      if (action.kind === "confirm-basis") {
        reveal(action.rowId, null, null);
        toast(`"${action.label}" was measured before its basis was recorded — confirm it on the line.`, "info");
        return;
      }

      const geometries = (snapshot?.geometries ?? []).filter((geometry) => action.geometryIds.includes(geometry.id));
      if (geometries.length > 1) {
        setChoice({ rowId: action.rowId, label: action.label, geometries });
        return;
      }
      // One annotation is not a choice, so it is opened without asking — but it
      // is still named, so the handles land on it rather than on the row.
      const only = geometries[0];
      reveal(action.rowId, only?.sheetId ?? action.sourceSheetIds[0] ?? null, only?.id ?? null);
    },
    [snapshot?.geometries, reveal],
  );

  return {
    choice,
    collapseTo,
    focusGeometry,
    // Coming back from a drawing hands the screen to the workbook again, which
    // is what makes Return restore the cell the user left.
    returnToWorkbook: useCallback(() => setCollapseTo("workbook"), []),
    closeChoice: useCallback(() => setChoice(null), []),
    open,
    chooseGeometry: useCallback(
      (geometry: PreconGeometry) => {
        setChoice(null);
        reveal(geometry.rowId, geometry.sheetId, geometry.id);
      },
      [reveal],
    ),
  };
}

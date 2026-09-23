// Small lookups the viewer wires into its hooks, kept out of the composition
// root for the 400-line ceiling.
import type { PreconBoqRow, PreconGeometry } from "@/api/precon";
import type { PathShape } from "./shape-edit-model";
import type { useSavedEdit } from "./use-saved-edit";
import type { useSelectInteractions } from "./use-select-interactions";

/**
 * The saved logical shape a geometry may be edited through — read from THAT
 * geometry's own `definition` (the DTO now serves one per drawing), so every
 * shape of a multi-drawing or assembled line edits independently. The
 * row-level last-write-wins definition is never consulted for shapes.
 */
export function curvedShapeResolver(_rowById: Map<string, PreconBoqRow>, _geometries: PreconGeometry[]) {
  return (g: PreconGeometry): PathShape | null => {
    const shape = g.definition?.shape;
    return shape?.role === "path" ? shape : null;
  };
}

/** The selected row's measuring geometry on the sheet, for a curved redraw. */
export function measuringGeometryResolver(sheetGeometries: PreconGeometry[]) {
  return (rowId: string): string | null => sheetGeometries.find((g) => g.rowId === rowId && g.kind !== "deduction")?.id ?? null;
}

/** The SavedEditLayer prop bundle, or null outside a select-tool row selection. */
export function savedEditLayerProps(args: {
  active: boolean;
  selectedRowId: string | null;
  /**
   * One annotation of the row, when the person has said which. A line measured
   * by several shapes would otherwise show handles on all of them, discarding
   * the answer the source chooser just asked for.
   */
  focusGeometryId: string | null;
  sheetGeometries: PreconGeometry[];
  savedEdit: ReturnType<typeof useSavedEdit>;
  select: ReturnType<typeof useSelectInteractions>;
  screenToPt: (clientX: number, clientY: number) => [number, number] | null;
  shapeOf: (geometry: PreconGeometry) => PathShape | null;
}) {
  const { active, selectedRowId, focusGeometryId, sheetGeometries, savedEdit, select, screenToPt, shapeOf } = args;
  if (!active || !selectedRowId) return null;
  const ofRow = sheetGeometries.filter((g) => g.rowId === selectedRowId);
  const chosen = focusGeometryId === null ? [] : ofRow.filter((g) => g.id === focusGeometryId);
  return {
    // A chosen annotation that is no longer on this row falls back to the row,
    // so a stale choice shows everything rather than nothing.
    geometries: chosen.length > 0 ? chosen : ofRow,
    edit: savedEdit.edit,
    screenToPt,
    onPickVertex: savedEdit.pickVertex,
    onMoveVertex: savedEdit.moveTo,
    onInsert: savedEdit.insertAt,
    onBendArc: savedEdit.bendArc,
    shapeOf,
    onContextVertex: select.openVertexMenu,
    onContextSegment: select.openSegmentMenu,
  };
}

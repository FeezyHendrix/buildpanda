import type { PreconBoqRow, PreconGeometry, PreconSheet } from "@/api/precon";
import type { PreconTool } from "@/lib/precon-meta";

export interface PreconSheetViewerProps {
  sessionId: string;
  sheets: PreconSheet[];
  activeSheet: PreconSheet | null;
  onSelectSheet: (sheetId: string) => void;
  geometries: PreconGeometry[];
  rows: PreconBoqRow[];
  selectedRowId: string | null;
  onSelectRow: (rowId: string | null) => void;
  tool: PreconTool;
  onToolChange: (tool: PreconTool) => void;
  zoomRequest?: { seq: number; kind: "in" | "out" | "fit" } | null;
  /**
   * Which annotation to put handles on, when a bill line has more than one and
   * the person has chosen. `seq` carries by value so choosing the same shape
   * twice re-frames it, exactly as `zoomRequest` does.
   */
  focusGeometry?: { seq: number; geometryId: string } | null;
  /** A line drawn by hand has been added to the bill (it is also selected). */
  onMeasurementCreated?: (row: PreconBoqRow) => void;
  /**
   * False while another surface owns the keyboard — the workbook grid, in
   * split view. Without this, typing `A` into a cell would also switch the
   * canvas to the Area tool behind it.
   */
  shortcutsEnabled?: boolean;
}

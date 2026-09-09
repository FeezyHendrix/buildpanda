import type { RefObject } from "react";
import type { PreconBoqRow, PreconGeometry, PreconSheet, SheetViewport } from "@/api/precon";
import type { PreconTool } from "@/lib/precon-meta";
import { InkLayer } from "./ink-layer";
import { OverlayLayer } from "./overlay-layer";
import { SheetOverlay } from "./sheet-overlay";
import { SymbolMatchesLayer } from "./symbol-matches-layer";
import { ViewportLayer } from "./viewport-layer";
import { PinLayer } from "./pins";
import type { LayerVisibility } from "./layer-toggles";
import type { DragRect } from "./use-draft";
import type { SymbolMatches } from "./symbol-matches-layer";

// Everything drawn over the sheet, in one place, so the viewer holds the
// transform and this holds the stack. Measurements, ink and comments each
// answer to their own visibility flag; the revision overlay, viewports and
// symbol matches belong to a tool that is running and are not layers a reader
// turns off.

const SCALE_COLOR = "#B85C00";
const DRAFT_COLOR = "#004DE7";

export interface SheetPage {
  widthPx: number;
  heightPx: number;
}

export interface LayerSheet {
  sessionId: string;
  sheetId: string;
  /** Sheet points ↔ canvas pixels, and the wrapper's scale. */
  toPx: (pt: number[]) => [number, number];
  toPt: (pxX: number, pxY: number) => [number, number];
  cssZoom: number;
}

export interface LayerDraft {
  vertices: number[][];
  anchors: number[][];
  arcMid: number[] | null;
}

export interface LayerRows {
  geometries: PreconGeometry[];
  rowById: Map<string, PreconBoqRow>;
  selectedRowId: string | null;
  emphasisRowIds: ReadonlySet<string> | null;
  onSelectRow: (rowId: string | null) => void;
}

export interface SheetLayersProps {
  /** Null until the sheet has rendered; the canvas mounts first so it can be drawn into. */
  page: SheetPage | null;
  sheet: LayerSheet;
  tool: PreconTool;
  layers: LayerVisibility;
  rows: LayerRows;
  draft: LayerDraft;
  viewports: SheetViewport[];
  dragRect: DragRect | null;
  /** The previous revision under this sheet, when the Overlay tool is on. */
  overlay: { sheet: PreconSheet; sheets: PreconSheet[]; onError: (message: string) => void } | null;
  matches: SymbolMatches | null;
  onToggleMatch: (index: number) => void;
  onRemoveViewport?: (id: string) => void;
  onDone: () => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export function SheetLayers(props: SheetLayersProps) {
  const { page, sheet, tool, layers, rows, draft, viewports, dragRect, overlay, matches } = props;
  const drafting = tool === "scale" || tool === "viewports";
  // The canvas is what the loader draws the sheet into, so it mounts before
  // there is a page. Everything else is positioned against that page's size
  // and cannot render until it exists.
  return (
    <>
      <canvas ref={props.canvasRef} className="block" />
      {!page ? null : (
      <>
      {overlay ? (
        <OverlayLayer
          sheet={overlay.sheet}
          sheets={overlay.sheets}
          widthPx={page.widthPx}
          heightPx={page.heightPx}
          onError={overlay.onError}
        />
      ) : null}
      {layers.measurements ? (
        <SheetOverlay
          widthPx={page.widthPx}
          heightPx={page.heightPx}
          geometries={rows.geometries}
          rowById={rows.rowById}
          selectedRowId={rows.selectedRowId}
          onSelectRow={rows.onSelectRow}
          draft={draft.vertices}
          draftMarkers={draft.anchors}
          arcMid={draft.arcMid}
          draftColor={drafting ? SCALE_COLOR : DRAFT_COLOR}
          draftClosed={tool === "area" || tool === "volume" || tool === "room_fill"}
          toPx={sheet.toPx}
          emphasisRowIds={rows.emphasisRowIds}
        />
      ) : null}
      {viewports.length > 0 || dragRect ? (
        <ViewportLayer
          widthPx={page.widthPx}
          heightPx={page.heightPx}
          viewports={viewports}
          toPx={sheet.toPx}
          cssZoom={sheet.cssZoom}
          dragRect={dragRect}
          dragColor={tool === "viewports" ? SCALE_COLOR : DRAFT_COLOR}
          onRemove={tool === "viewports" ? props.onRemoveViewport : undefined}
        />
      ) : null}
      {matches ? (
        <SymbolMatchesLayer
          widthPx={page.widthPx}
          heightPx={page.heightPx}
          matches={matches}
          toPx={sheet.toPx}
          onToggle={props.onToggleMatch}
        />
      ) : null}
      {layers.ink ? (
        <InkLayer
          sessionId={sheet.sessionId}
          sheetId={sheet.sheetId}
          widthPx={page.widthPx}
          heightPx={page.heightPx}
          toPx={sheet.toPx}
          toPt={sheet.toPt}
          cssZoom={sheet.cssZoom}
          drawing={tool === "pen"}
          onDrawn={props.onDone}
        />
      ) : null}
      {layers.comments ? (
        <PinLayer
          key={sheet.sheetId}
          sessionId={sheet.sessionId}
          sheetId={sheet.sheetId}
          widthPx={page.widthPx}
          heightPx={page.heightPx}
          toPx={sheet.toPx}
          toPt={sheet.toPt}
          cssZoom={sheet.cssZoom}
          placing={tool === "comment"}
          selectedRowId={rows.selectedRowId}
          rowById={rows.rowById}
          onPlaced={props.onDone}
          onSelectRow={rows.onSelectRow}
        />
      ) : null}
      </>
      )}
    </>
  );
}

SheetLayers.displayName = "SheetLayers";

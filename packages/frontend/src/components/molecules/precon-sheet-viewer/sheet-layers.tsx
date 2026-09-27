import type { RefObject } from "react";
import type { PreconBoqRow, PreconGeometry, PreconSheet, SheetViewport } from "@/api/precon";
import type { PreconTool } from "@/lib/precon-meta";
import { InkLayer } from "./ink-layer";
import { OverlayLayer } from "./overlay-layer";
import { affineOf, conjugateAffine } from "./overlay-model";
import type { OverlayRenderModel } from "./use-overlay-suite";
import { SheetOverlay } from "./sheet-overlay";
import { SymbolMatchesLayer } from "./symbol-matches-layer";
import { RoomPreviewLayer } from "./room-preview-layer";
import { ScaleEndpointsLayer } from "./scale-endpoints-layer";
import { ViewportEditLayer, type RegionEdit } from "./viewport-edit-layer";
import type { ScalePrompt } from "./use-scale-prompt";
import type { RoomPreview, SymbolTemplate } from "./use-detection-tools";
import type { SymbolReview } from "./detection-model";
import { ViewportLayer } from "./viewport-layer";
import { PinLayer } from "./pins";
import { SavedEditLayer } from "./saved-edit-layer";
import type { SavedEditState } from "./use-saved-edit";
import type { LayerVisibility } from "./layer-toggles";
import type { PenStyle } from "./pen-presets";
import type { DragRect } from "./use-draft";

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
  closeHint?: number[] | null;
}

export interface LayerRows {
  geometries: PreconGeometry[];
  rowById: Map<string, PreconBoqRow>;
  selectedRowId: string | null;
  emphasisRowIds: ReadonlySet<string> | null;
  onSelectRow: (rowId: string | null) => void;
  batchIds?: ReadonlySet<string>;
  onPickGeometry?: (geometry: PreconGeometry, e: React.MouseEvent) => void;
  onGeometryPointerDown?: (geometry: PreconGeometry, e: React.PointerEvent) => void;
  dragDeltaPx?: [number, number] | null;
}

export interface LayerSavedEdit {
  /** The selected row's shapes on this sheet — the ones that grow handles. */
  geometries: PreconGeometry[];
  edit: SavedEditState | null;
  screenToPt: (clientX: number, clientY: number) => [number, number] | null;
  onPickVertex: (geometry: PreconGeometry, index: number) => void;
  onMoveVertex: (index: number, pt: number[]) => void;
  onInsert: (segmentIndex: number, pt: number[]) => void;
  onContextVertex: (geometry: PreconGeometry, index: number, clientX: number, clientY: number) => void;
  onContextSegment: (geometry: PreconGeometry, segmentIndex: number, clientX: number, clientY: number) => void;
  onBendArc?: (segmentIndex: number, pt: number[]) => void;
  shapeOf?: (geometry: PreconGeometry) => import("./shape-edit-model").PathShape | null;
}

export interface SheetLayersProps {
  /** The drawn scale reference with draggable endpoints, while calibrating. */
  scaleEdit?: { prompt: ScalePrompt; screenToPt: (x: number, y: number) => [number, number] | null; onMovePoint: (which: "from" | "to", pt: [number, number]) => void } | null;
  penStyle: PenStyle;
  /** Vertex handles over the selected saved measurement (select tool only). */
  savedEdit?: LayerSavedEdit | null;
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
  /** The persisted/aligned revision overlay (contract 23); replaces `overlay` when present. */
  ovl?: { model: OverlayRenderModel; onError: (message: string) => void } | null;
  detection: {
    room: RoomPreview | null;
    template: SymbolTemplate | null;
    review: SymbolReview | null;
    screenToPt: (clientX: number, clientY: number) => [number, number] | null;
    onRoomVertex: (index: number, pt: number[]) => void;
    onToggleMatch: (index: number) => void;
  };
  onRemoveViewport?: (id: string) => void;
  onEditViewport?: (id: string) => void;
  regionEdit?: { edit: RegionEdit; screenToPt: (x: number, y: number) => [number, number] | null; onRect: (rect: [number, number, number, number]) => void } | null;
  onDone: () => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export function SheetLayers(props: SheetLayersProps) {
  const { page, sheet, tool, layers, rows, draft, viewports, dragRect, overlay, detection } = props;
  const drafting = tool === "scale" || tool === "viewports";
  // The canvas is what the loader draws the sheet into, so it mounts before
  // there is a page. Everything else is positioned against that page's size
  // and cannot render until it exists.
  return (
    <>
      <canvas ref={props.canvasRef} className="block" role="img" aria-label="Takeoff drawing" />
      {!page ? null : (
      <>
      {props.ovl ? (
        <OverlayLayer
          key={props.ovl.model.sheet.id}
          sheet={props.ovl.model.sheet}
          sheets={props.ovl.model.sheets}
          widthPx={page.widthPx}
          heightPx={page.heightPx}
          transform={`matrix(${conjugateAffine(affineOf(sheet.toPx), props.ovl.model.matrix).join(",")})`}
          opacity={props.ovl.model.opacity}
          visible={props.ovl.model.visible}
          onError={props.ovl.onError}
        />
      ) : overlay ? (
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
          batchIds={rows.batchIds}
          onPickGeometry={rows.onPickGeometry}
          onGeometryPointerDown={rows.onGeometryPointerDown}
          dragDeltaPx={rows.dragDeltaPx}
          draft={draft.vertices}
          draftMarkers={draft.anchors}
          arcMid={draft.arcMid}
          closeHint={draft.closeHint ?? null}
          draftColor={drafting ? SCALE_COLOR : DRAFT_COLOR}
          draftClosed={tool === "area" || tool === "volume" || tool === "room_fill"}
          toPx={sheet.toPx}
          emphasisRowIds={rows.emphasisRowIds}
        />
      ) : null}
      {props.savedEdit && props.savedEdit.geometries.length > 0 ? (
        <SavedEditLayer
          widthPx={page.widthPx}
          heightPx={page.heightPx}
          geometries={props.savedEdit.geometries}
          edit={props.savedEdit.edit}
          toPx={sheet.toPx}
          cssZoom={sheet.cssZoom}
          screenToPt={props.savedEdit.screenToPt}
          onPickVertex={props.savedEdit.onPickVertex}
          onMoveVertex={props.savedEdit.onMoveVertex}
          onInsert={props.savedEdit.onInsert}
          onContextVertex={props.savedEdit.onContextVertex}
          onContextSegment={props.savedEdit.onContextSegment}
          onBendArc={props.savedEdit.onBendArc}
          shapeOf={props.savedEdit.shapeOf}
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
          onEdit={tool === "viewports" ? props.onEditViewport : undefined}
        />
      ) : null}
      {detection.review || detection.template ? (
        <SymbolMatchesLayer
          widthPx={page.widthPx}
          heightPx={page.heightPx}
          review={detection.review}
          template={detection.template}
          toPx={sheet.toPx}
          onToggle={detection.onToggleMatch}
        />
      ) : null}
      {props.regionEdit ? (
        <ViewportEditLayer
          widthPx={page.widthPx}
          heightPx={page.heightPx}
          edit={props.regionEdit.edit}
          toPx={sheet.toPx}
          cssZoom={sheet.cssZoom}
          screenToPt={props.regionEdit.screenToPt}
          onRect={props.regionEdit.onRect}
        />
      ) : null}
      {props.scaleEdit ? (
        <ScaleEndpointsLayer
          widthPx={page.widthPx}
          heightPx={page.heightPx}
          prompt={props.scaleEdit.prompt}
          toPx={sheet.toPx}
          cssZoom={sheet.cssZoom}
          screenToPt={props.scaleEdit.screenToPt}
          onMovePoint={props.scaleEdit.onMovePoint}
        />
      ) : null}
      {detection.room ? (
        <RoomPreviewLayer
          widthPx={page.widthPx}
          heightPx={page.heightPx}
          room={detection.room}
          toPx={sheet.toPx}
          cssZoom={sheet.cssZoom}
          screenToPt={detection.screenToPt}
          onMoveVertex={detection.onRoomVertex}
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
          selectable={tool === "select"}
          style={props.penStyle}
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

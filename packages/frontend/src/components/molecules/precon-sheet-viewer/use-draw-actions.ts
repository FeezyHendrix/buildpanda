import type { PreconBoqRow, PreconSheet } from "@/api/precon";
import { isVersionConflict, useAddPreconDeduction, useUpdatePreconGeometry } from "@/hooks/use-precon";
import { newOperationId, useEditorOperation } from "@/hooks/use-precon-editor";
import { getApiErrorMessage } from "@/lib/api-error";
import { PRECON_TOOL_BY_KEY, type PreconTool } from "@/lib/precon-meta";
import type { ScalePrompt } from "./use-scale-prompt";
import { MEASURE_GEOMETRY_KIND, MEASURE_MAX_VERTICES, MEASURE_MIN_VERTICES } from "./measure-maths";
import { rectOf, rectangleVertices } from "./draft-maths";
import { firstVertexCloseTarget } from "./polygon-validity";
import { withoutTrailingDuplicate } from "./draft-history";
import type { useDraft, useDragRect } from "./use-draft";
import type { useViewerTools } from "./use-viewer-tools";
import type { PendingMeasurement } from "./measurement-composer";

export interface DrawActionsDeps {
  sessionId: string;
  tool: PreconTool;
  activeSheet: PreconSheet | null;
  selectedRow: PreconBoqRow | null;
  redrawTargetId: string | null;
  drawingEnabled: boolean;
  calibratingViewport: boolean;
  nonDrawingTools: ReadonlySet<PreconTool>;
  scalePrompt: ScalePrompt | null;
  pending: PendingMeasurement | null;
  /** Area/volume drawing mode: clicks build a polygon, or a drag draws the rectangle. */
  areaShape: "polygon" | "rectangle";
  /** Visible Straight/Arc mode: the next placed segment curves (same as Alt-click). */
  arcMode: boolean;
  screenPxToPt: (px: number) => number;
  draftApi: ReturnType<typeof useDraft>;
  dragRect: ReturnType<typeof useDragRect>;
  tools: ReturnType<typeof useViewerTools>;
  screenToPt: (clientX: number, clientY: number) => [number, number] | null;
  snapAndOrtho: (pt: [number, number], shift: boolean, last: number[] | null, bypassSnap?: boolean) => number[];
  setPending: (pending: PendingMeasurement | null) => void;
  setNote: (note: string | null) => void;
  startScale: (fromPt: [number, number], toPt: [number, number]) => void;
  /** The selected row's measuring geometry on this sheet, for a curved redraw's `update-geometry`. */
  measuringGeometryIdFor?: (rowId: string) => string | null;
}

/**
 * The drawing gestures lifted out of the viewer: a click placing a point, a
 * drag closing a rectangle, Enter/double-click finishing, and the redraw path
 * that persists onto the selected line. Behaviour is unchanged — the viewer
 * stays the composition root and this owns the how.
 */
export function useDrawActions(deps: DrawActionsDeps) {
  const { tool, activeSheet, selectedRow, draftApi, dragRect, tools } = deps;
  const { draft, anchors, arcMid, segments } = draftApi;
  const meta = PRECON_TOOL_BY_KEY[tool];
  const updateGeometry = useUpdatePreconGeometry(deps.sessionId);
  const addDeduction = useAddPreconDeduction(deps.sessionId);
  const operation = useEditorOperation(deps.sessionId);

  /** The logical outline when any side curves; straight drafts keep the plain `vertices` contract. */
  const shapeFor = (vertices: number[][], drawn = segments) => {
    if (!drawn.some((seg) => seg.kind === "arc") || vertices.length === 0) return undefined;
    const closed = tool === "area" || tool === "volume" || tool === "room_fill";
    return { role: "path" as const, start: [vertices[0]![0]!, vertices[0]![1]!] as [number, number], segments: drawn, closed };
  };

  const finishDraft = (vertices: number[][] = draft, drawnSegments = segments) => {
    if (tool === "scale") {
      if (vertices.length >= 2) deps.startScale([vertices[0]![0]!, vertices[0]![1]!], [vertices[1]![0]!, vertices[1]![1]!]);
      return;
    }
    if (vertices.length === 0) return;
    const measure = meta.measure;
    const redrawing = Boolean(selectedRow && deps.redrawTargetId === selectedRow.id);
    if (measure && !redrawing) {
      // draw first, name after: the shape stays on the sheet while the composer names it
      if (vertices.length >= MEASURE_MIN_VERTICES[measure]) deps.setPending({ tool: measure, vertices, shape: shapeFor(vertices, drawnSegments) });
      else deps.setNote(`Add at least ${MEASURE_MIN_VERTICES[measure]} points before finishing.`);
      return;
    }
    if (!selectedRow) return draftApi.clear();
    // The draft survives a failed save: it is only cleared once the write lands.
    const onSuccess = () => draftApi.clear();
    const onError = (error: unknown) =>
      deps.setNote(isVersionConflict(error) ? "Row changed elsewhere — refreshed; redraw to apply." : getApiErrorMessage(error, "Measurement failed"));
    const base = { rowId: selectedRow.id, version: selectedRow.version, sheetId: activeSheet?.id };
    if (tool === "deduct" && vertices.length >= 3) addDeduction.mutate({ ...base, label: "Opening (manual)", vertices }, { onSuccess, onError });
    else if (measure && vertices.length >= MEASURE_MIN_VERTICES[measure]) {
      const shape = shapeFor(vertices, drawnSegments);
      const geometryId = shape ? deps.measuringGeometryIdFor?.(selectedRow.id) : null;
      if (shape && geometryId) {
        // a curved redraw carries the authoritative shape through the envelope
        // (the legacy PATCH route is vertices-only and would flatten the arcs)
        operation.mutate(
          {
            operationId: newOperationId(),
            expectedRows: [{ id: selectedRow.id, version: selectedRow.version }],
            command: { kind: "update-geometry", geometryId, shape },
          },
          { onSuccess, onError },
        );
      } else {
        updateGeometry.mutate({ ...base, kind: MEASURE_GEOMETRY_KIND[measure], vertices }, { onSuccess, onError });
      }
    }
    else draftApi.clear();
  };

  // A double-click fires click–click–finish: the second click lands a point on
  // the first, so Finish strips that repeated final anchor before committing.
  const finishFromDoubleClick = () => {
    const deduped = withoutTrailingDuplicate({ vertices: draft, anchors, arcMid, segments });
    if (deduped.vertices !== draft) draftApi.replace(deduped.vertices);
    finishDraft(deduped.vertices, deduped.segments);
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    if (dragRect.consumeClick()) return;
    if (!deps.drawingEnabled || deps.scalePrompt || deps.pending || tools.detectionActive || tools.searching) return;
    if (deps.nonDrawingTools.has(tool) || (tool === "viewports" && !deps.calibratingViewport)) return;
    const raw = deps.screenToPt(e.clientX, e.clientY);
    if (!raw) return;
    if (tool === "room_fill") return tools.roomFillAt(raw);
    if (tool === "scale" && anchors.length >= 2) return;
    const polygonal = (tool === "area" || tool === "volume") && deps.areaShape === "polygon";
    if ((tool === "area" || tool === "volume") && deps.areaShape === "rectangle") return;
    const last = draft[draft.length - 1] ?? null;
    const snapped = deps.snapAndOrtho(raw, e.shiftKey, last, e.ctrlKey || e.metaKey);
    // Clicking back on the first anchor closes the polygon without a duplicate
    // point — checked on the raw AND the snapped candidate, because the snap
    // index can pull the closing click away from an unsnapped first anchor.
    const threshold = deps.screenPxToPt(20);
    if (polygonal && (firstVertexCloseTarget(anchors, raw, threshold) || firstVertexCloseTarget(anchors, snapped, threshold))) {
      return finishDraft();
    }
    const arcs = tool !== "scale" && tool !== "count" && tool !== "viewports";
    const next = draftApi.addPoint(snapped, arcs && (e.altKey || deps.arcMode));
    if (tool === "viewports") return tools.calibrateViewport(next.vertices);
    // a length (and the scale bar) is two clicks: it finishes itself
    const max = tool === "scale" ? 2 : meta.measure ? MEASURE_MAX_VERTICES[meta.measure] : undefined;
    if (max && next.anchors.length >= max && !next.arcMid) finishDraft(next.vertices);
  };

  const onDragEnd = ({ start, current }: { start: [number, number]; current: [number, number] }) => {
    if (tool === "area" || tool === "volume") {
      const vertices = rectangleVertices(start, current);
      draftApi.replace(vertices);
      finishDraft(vertices);
    } else if (tool === "viewports") tools.startViewport(rectOf(start, current));
    else if (tool === "find_symbol") tools.findSymbolIn(rectOf(start, current));
  };

  return { finishDraft, finishFromDoubleClick, onCanvasClick, onDragEnd };
}

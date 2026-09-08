import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@/components/atoms/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import type { PreconBoqRow, PreconGeometry, PreconSheet } from "@/api/precon";
import { isVersionConflict, useAddPreconDeduction, usePreconSnapIndex, useUpdatePreconGeometry, useUpdatePreconSheet } from "@/hooks/use-precon";
import { PRECON_TOOL_BY_KEY, scaleRatioOf, type PreconTool, type PreconToolMeta } from "@/lib/precon-meta";
import { toast } from "@/lib/toast";
import { SheetToolbar } from "./precon-sheet-viewer/sheet-toolbar";
import { SheetOverlay } from "./precon-sheet-viewer/sheet-overlay";
import { PinLayer } from "./precon-sheet-viewer/pins";
import { SheetLegend, buildLegendEntries } from "./precon-sheet-viewer/sheet-legend";
import { NoScaleBanner, ScalePromptBanner, type ScalePrompt } from "./precon-sheet-viewer/sheet-banners";
import { SheetSettings } from "./precon-session/sheet-settings";
import { FIT_VIEW, useSheetView } from "./precon-sheet-viewer/use-sheet-view";
import { BASE_RASTER, useSheetLoader } from "./precon-sheet-viewer/use-sheet-loader";
import { ToolPalette } from "./precon-sheet-viewer/tool-palette";
import { SheetStatusBar } from "./precon-sheet-viewer/sheet-status-bar";
import { ZoomControls } from "./precon-sheet-viewer/zoom-controls";
import { useToolShortcuts } from "./precon-sheet-viewer/use-tool-shortcuts";
import { MeasurementComposer, type PendingMeasurement } from "./precon-sheet-viewer/measurement-composer";
import { MEASURE_GEOMETRY_KIND, MEASURE_MAX_VERTICES, MEASURE_MIN_VERTICES } from "./precon-sheet-viewer/measure-maths";

export type { PreconTool };

const SNAP_PX = 10;
const FLASH_MS = 1600;

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
  /** A line drawn by hand has been added to the bill (it is also selected). */
  onMeasurementCreated?: (row: PreconBoqRow) => void;
}

/**
 * The sheet canvas with its palette. With no bill line selected the measuring
 * tools draw a new line (draw first, name after); with one selected they
 * redraw it, as before. Vertices are sheet points in both cases.
 */
export function PreconSheetViewer({
  sessionId,
  sheets,
  activeSheet,
  onSelectSheet,
  geometries,
  rows,
  selectedRowId,
  onSelectRow,
  tool,
  onToolChange,
  zoomRequest,
  onMeasurementCreated,
}: PreconSheetViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { view, setView, zoomBy, zoomFit, onMouseDown, onMouseMove, endPan } = useSheetView(containerRef, tool === "select");
  const fitView = useCallback(() => setView(FIT_VIEW), [setView]);
  const { page, rendering, loadError } = useSheetLoader({ canvasRef, activeSheet, sheets, userZoom: view.userZoom, onLoaded: fitView });

  const [draft, setDraft] = useState<number[][]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // two drawn points whose real distance the reviewer is about to type
  const [scalePrompt, setScalePrompt] = useState<ScalePrompt | null>(null);
  // a finished shape waiting for its name
  const [pending, setPending] = useState<PendingMeasurement | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);
  const [legendGroup, setLegendGroup] = useState<string | null>(null);
  const [flashRowId, setFlashRowId] = useState<string | null>(null);

  // A sheet change drops any half-drawn shape, scale prompt and legend pick.
  const [draftSheetId, setDraftSheetId] = useState(activeSheet?.id ?? null);
  if (draftSheetId !== (activeSheet?.id ?? null)) {
    setDraftSheetId(activeSheet?.id ?? null);
    setDraft([]);
    setScalePrompt(null);
    setLegendGroup(null);
  }

  const { data: snapPoints = [] } = usePreconSnapIndex(activeSheet?.id ?? null);
  const updateGeometry = useUpdatePreconGeometry(sessionId);
  const addDeduction = useAddPreconDeduction(sessionId);
  const updateSheet = useUpdatePreconSheet(sessionId);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const sheetGeometries = useMemo(() => geometries.filter((g) => g.sheetId === activeSheet?.id), [geometries, activeSheet?.id]);
  const legendEntries = useMemo(() => buildLegendEntries(sheetGeometries, rowById), [sheetGeometries, rowById]);
  const elementGroups = useMemo(() => [...new Set(rows.flatMap((r) => (r.elementGroup ? [r.elementGroup] : [])))], [rows]);
  const emphasisRowIds = useMemo(() => {
    if (flashRowId) return new Set([flashRowId]);
    if (!legendGroup) return null;
    return new Set(legendEntries.find((entry) => entry.group === legendGroup)?.rowIds ?? []);
  }, [flashRowId, legendGroup, legendEntries]);

  const cssZoom = page ? (BASE_RASTER * view.userZoom) / page.rasterScale : view.userZoom;
  const toPx = useCallback(
    (pt: number[]): [number, number] => {
      const rs = page?.rasterScale ?? BASE_RASTER;
      return [pt[0]! * rs, page!.heightPx - pt[1]! * rs];
    },
    [page],
  );
  const toPt = (pxX: number, pxY: number): [number, number] => {
    const rs = page?.rasterScale ?? BASE_RASTER;
    return [pxX / rs, (page!.heightPx - pxY) / rs];
  };
  const screenToCanvas = (clientX: number, clientY: number): [number, number] | null => {
    const container = containerRef.current;
    if (!container || !page) return null;
    const rect = container.getBoundingClientRect();
    return [(clientX - rect.left - view.tx) / cssZoom, (clientY - rect.top - view.ty) / cssZoom];
  };
  const applySnapAndOrtho = (pt: [number, number], shift: boolean): [number, number] => {
    let [x, y] = pt;
    const thresholdPt = SNAP_PX / (BASE_RASTER * view.userZoom);
    let best: number[] | null = null;
    let bestDist = thresholdPt;
    for (const p of snapPoints) {
      const d = Math.hypot(p[0]! - x, p[1]! - y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    if (best) [x, y] = [best[0]!, best[1]!];
    if (shift && draft.length > 0) {
      const prev = draft[draft.length - 1]!;
      if (Math.abs(x - prev[0]!) > Math.abs(y - prev[1]!)) y = prev[1]!;
      else x = prev[0]!;
    }
    return [x, y];
  };

  const selectedRow = selectedRowId ? (rowById.get(selectedRowId) ?? null) : null;
  const meta = PRECON_TOOL_BY_KEY[tool];
  const blockedReasonFor = (m: PreconToolMeta): string | null => {
    if (m.key === "select" || m.key === "legend") return null;
    if (!activeSheet) return "Open a sheet first";
    if (m.key === "scale") return null;
    if (!activeSheet.scaleMmPerPt) return "Set this sheet's scale first (S, or Sheet settings)";
    if (m.needsLine && !selectedRow) return "Select a bill line first";
    if ((m.key === "volume" || m.key === "wall_area") && selectedRow) return "Draws a new line — clear the selection first";
    return null;
  };
  const drawingEnabled = tool !== "select" && !blockedReasonFor(meta);

  const changeTool = (next: PreconTool) => {
    setDraft([]);
    setScalePrompt(null);
    setNote(null);
    onToolChange(next);
  };

  const finishDraft = (vertices: number[][] = draft) => {
    if (tool === "scale") {
      if (vertices.length >= 2) setScalePrompt({ ptLength: Math.hypot(vertices[1]![0]! - vertices[0]![0]!, vertices[1]![1]! - vertices[0]![1]!), mm: "" });
      return;
    }
    if (vertices.length === 0) return;
    const measure = meta.measure;
    if (measure && !selectedRow) {
      // draw first, name after: the composer owns the draft from here
      if (vertices.length >= MEASURE_MIN_VERTICES[measure]) setPending({ tool: measure, vertices });
      else setNote(`Add at least ${MEASURE_MIN_VERTICES[measure]} points before finishing.`);
      return;
    }
    if (!selectedRow) {
      setDraft([]);
      return;
    }
    const onError = (error: unknown) =>
      setNote(isVersionConflict(error) ? "Row changed elsewhere — refreshed; redraw to apply." : getApiErrorMessage(error, "Measurement failed"));
    const base = { rowId: selectedRow.id, version: selectedRow.version, sheetId: activeSheet?.id };
    if (tool === "deduct" && vertices.length >= 3) addDeduction.mutate({ ...base, label: "Opening (manual)", vertices }, { onError });
    else if (measure && vertices.length >= MEASURE_MIN_VERTICES[measure]) updateGeometry.mutate({ ...base, kind: MEASURE_GEOMETRY_KIND[measure], vertices }, { onError });
    setDraft([]);
  };

  // Esc always returns to Select, dropping whatever was half-drawn.
  const cancel = () => {
    setDraft([]);
    setScalePrompt(null);
    setNote(null);
    if (tool !== "select") onToolChange("select");
  };

  useToolShortcuts(
    {
      onEscape: cancel,
      onEnter: () => {
        if (!scalePrompt) finishDraft();
      },
      onTool: (next) => {
        if (!blockedReasonFor(PRECON_TOOL_BY_KEY[next])) changeTool(next);
      },
      onToggleLegend: () => setLegendOpen((v) => !v),
    },
    !pending,
  );

  const applyDrawnScale = () => {
    if (!scalePrompt || !activeSheet) return;
    const mm = Number(scalePrompt.mm);
    if (!Number.isFinite(mm) || mm <= 0) {
      toast("Enter the real distance between the two points in millimetres.", "error");
      return;
    }
    const mmPerPt = mm / scalePrompt.ptLength;
    updateSheet.mutate(
      { sheetId: activeSheet.id, input: { scaleMmPerPt: mmPerPt, dimUnit: "mm" } },
      {
        onSuccess: () => {
          toast(`Scale set to 1:${scaleRatioOf(mmPerPt)}. Re-measure the sheet from Sheet settings to redraw its lines.`, "success");
          setScalePrompt(null);
          setDraft([]);
          onToolChange("select");
        },
        onError: (e) => toast(getApiErrorMessage(e, "Could not set the scale."), "error"),
      },
    );
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    if (!drawingEnabled || scalePrompt || pending) return;
    if (tool === "scale" && draft.length >= 2) return;
    const canvasPt = screenToCanvas(e.clientX, e.clientY);
    if (!canvasPt) return;
    const next = [...draft, applySnapAndOrtho(toPt(canvasPt[0], canvasPt[1]), e.shiftKey)];
    setDraft(next);
    // a length is two clicks: it finishes itself
    const max = meta.measure ? MEASURE_MAX_VERTICES[meta.measure] : undefined;
    if (max && next.length >= max) finishDraft(next);
  };

  const onCreated = (row: PreconBoqRow) => {
    setDraft([]);
    onSelectRow(row.id);
    onMeasurementCreated?.(row);
    setFlashRowId(row.id);
    window.setTimeout(() => setFlashRowId((current) => (current === row.id ? null : current)), FLASH_MS);
  };

  useEffect(() => {
    if (!zoomRequest) return;
    if (zoomRequest.kind === "in") zoomBy(1.5);
    else if (zoomRequest.kind === "out") zoomBy(1 / 1.5);
    else zoomFit();
  }, [zoomRequest, zoomBy, zoomFit]);

  const banner = note ?? loadError;

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      <SheetToolbar sheets={sheets} activeSheet={activeSheet} onSelectSheet={onSelectSheet} settingsOpen={settingsOpen} onToggleSettings={() => setSettingsOpen((v) => !v)} />

      {activeSheet && !scalePrompt ? (
        <SheetStatusBar sheet={activeSheet} tool={tool} selectedRow={selectedRow} drawingEnabled={drawingEnabled} draft={draft} onClearSelection={() => onSelectRow(null)} />
      ) : null}
      {activeSheet && !activeSheet.scaleMmPerPt && !scalePrompt ? (
        <NoScaleBanner message={activeSheet.error ?? "No calibrated scale on this sheet."} onOpenSettings={() => setSettingsOpen(true)} onDrawScale={() => changeTool("scale")} />
      ) : null}
      {scalePrompt ? (
        <ScalePromptBanner prompt={scalePrompt} saving={updateSheet.isPending} onChange={(mm) => setScalePrompt({ ...scalePrompt, mm })} onApply={applyDrawnScale} onRedraw={() => setScalePrompt(null)} />
      ) : null}
      {banner ? <p className="border-b border-amber-100 bg-amber-50 px-3 py-1 text-[11px] text-amber-700">{banner}</p> : null}

      <div className="flex min-h-0 flex-1">
        <ToolPalette tool={tool} onToolChange={changeTool} blockedReasonFor={blockedReasonFor} legendOpen={legendOpen} onToggleLegend={() => setLegendOpen((v) => !v)} />
        <div
          ref={containerRef}
          className={cn("relative min-h-0 flex-1 overflow-hidden bg-gray-100", tool === "select" ? "cursor-grab" : "cursor-crosshair")}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endPan}
          onMouseLeave={endPan}
          onClick={onCanvasClick}
          onDoubleClick={() => finishDraft()}
        >
          {rendering ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner size="md" />
            </div>
          ) : null}
          <div className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${cssZoom})`, transformOrigin: "0 0" }}>
            <canvas ref={canvasRef} className="block" />
            {page ? (
              <SheetOverlay
                widthPx={page.widthPx}
                heightPx={page.heightPx}
                geometries={sheetGeometries}
                rowById={rowById}
                selectedRowId={selectedRowId}
                onSelectRow={onSelectRow}
                draft={draft}
                draftColor={tool === "scale" ? "#B85C00" : "#004DE7"}
                toPx={toPx}
                emphasisRowIds={emphasisRowIds}
              />
            ) : null}
            {page && activeSheet ? (
              <PinLayer
                key={activeSheet.id}
                sessionId={sessionId}
                sheetId={activeSheet.id}
                widthPx={page.widthPx}
                heightPx={page.heightPx}
                toPx={toPx}
                toPt={toPt}
                cssZoom={cssZoom}
                placing={tool === "comment"}
                selectedRowId={selectedRowId}
                rowById={rowById}
                onPlaced={() => onToolChange("select")}
                onSelectRow={onSelectRow}
              />
            ) : null}
          </div>
          <SheetLegend entries={legendEntries} open={legendOpen} onToggle={() => setLegendOpen((v) => !v)} activeGroup={legendGroup} onPickGroup={setLegendGroup} />
          <ZoomControls userZoom={view.userZoom} onZoomBy={zoomBy} onFit={zoomFit} />
          {settingsOpen && activeSheet ? (
            <SheetSettings
              key={activeSheet.id}
              sessionId={sessionId}
              sheet={activeSheet}
              onClose={() => setSettingsOpen(false)}
              onDrawScale={() => {
                setSettingsOpen(false);
                changeTool("scale");
              }}
            />
          ) : null}
        </div>
      </div>

      {pending && activeSheet ? (
        <MeasurementComposer sessionId={sessionId} sheet={activeSheet} pending={pending} elementGroups={elementGroups} onClose={() => setPending(null)} onCreated={onCreated} />
      ) : null}
    </div>
  );
}
PreconSheetViewer.displayName = "PreconSheetViewer";

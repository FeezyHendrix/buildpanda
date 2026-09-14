import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@/components/atoms/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import type { PreconBoqRow, PreconGeometry, PreconSheet } from "@/api/precon";
import { isVersionConflict, useAddPreconDeduction, usePreconSnapIndex, useUpdatePreconGeometry, useUpdatePreconSheet } from "@/hooks/use-precon";
import { PRECON_TOOL_BY_KEY, scaleRatioOf, type PreconTool, type PreconToolMeta } from "@/lib/precon-meta";
import { toast } from "@/lib/toast";
import { SheetToolbar } from "./precon-sheet-viewer/sheet-toolbar";
import { SheetLegend, buildLegendEntries } from "./precon-sheet-viewer/sheet-legend";
import { NoScaleBanner, ScalePromptBanner, type ScalePrompt } from "./precon-sheet-viewer/sheet-banners";
import { SheetSettings } from "./precon-session/sheet-settings";
import { FIT_VIEW, useSheetView } from "./precon-sheet-viewer/use-sheet-view";
import { useSheetLoader } from "./precon-sheet-viewer/use-sheet-loader";
import { useSheetCoords } from "./precon-sheet-viewer/use-sheet-coords";
import { ToolPalette } from "./precon-sheet-viewer/tool-palette";
import { SheetStatusBar } from "./precon-sheet-viewer/sheet-status-bar";
import { ZoomControls } from "./precon-sheet-viewer/zoom-controls";
import { useToolShortcuts } from "./precon-sheet-viewer/use-tool-shortcuts";
import { MeasurementComposer, type PendingMeasurement } from "./precon-sheet-viewer/measurement-composer";
import { MEASURE_GEOMETRY_KIND, MEASURE_MAX_VERTICES, MEASURE_MIN_VERTICES } from "./precon-sheet-viewer/measure-maths";
import { rectOf, rectangleVertices, scaleForDraft, viewportAt } from "./precon-sheet-viewer/draft-maths";
import { useDraft, useDragRect } from "./precon-sheet-viewer/use-draft";
import { useViewerTools } from "./precon-sheet-viewer/use-viewer-tools";
import { blockedReasonFor } from "./precon-sheet-viewer/tool-availability";
import { ViewportPromptBanner } from "./precon-sheet-viewer/viewport-prompt";
import { Magnifier, useMagnifierHold } from "./precon-sheet-viewer/magnifier";
import { TypicalPopover } from "./precon-sheet-viewer/typical-popover";
import { SymbolMatchesBanner } from "./precon-sheet-viewer/symbol-matches-layer";
import { SheetLayers } from "./precon-sheet-viewer/sheet-layers";
import { MARKUP_KIND } from "@/api/drawing-markup";
import { usePreconMarkups } from "@/hooks/use-precon-markups";
import { ALL_LAYERS_VISIBLE, LayerToggles, type SheetLayer } from "./precon-sheet-viewer/layer-toggles";

export type { PreconTool };

const FLASH_MS = 1600;
/** Tools that take a mousedown-drag-mouseup box. */
const DRAG_TOOLS = new Set<PreconTool>(["area", "volume", "viewports", "find_symbol"]);
/** Tools that never add a point on click (toggles, popovers, the pin layer's own click). */
const NON_DRAWING_TOOLS = new Set<PreconTool>(["select", "legend", "magnifier", "overlay", "typical", "comment", "pen", "find_symbol"]);

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
 * redraw it. Vertices are sheet points in both cases.
 */
export function PreconSheetViewer({ sessionId, sheets, activeSheet, onSelectSheet, geometries, rows, selectedRowId, onSelectRow, tool, onToolChange, zoomRequest, onMeasurementCreated }: PreconSheetViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { view, setView, zoomBy, zoomFit, onMouseDown, onMouseMove, endPan } = useSheetView(containerRef, tool === "select");
  const fitView = useCallback(() => setView(FIT_VIEW), [setView]);
  const { page, rendering, loadError } = useSheetLoader({ canvasRef, activeSheet, sheets, userZoom: view.userZoom, onLoaded: fitView });
  const { data: snapPoints = [] } = usePreconSnapIndex(activeSheet?.id ?? null);
  const { cssZoom, toPx, toPt, screenToCanvas, screenToPt, snapAndOrtho } = useSheetCoords({ page, view, containerRef, snapPoints });

  const draftApi = useDraft();
  const { draft, anchors, arcMid } = draftApi;
  const dragRect = useDragRect(screenToPt);
  const [note, setNote] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layers, setLayers] = useState(ALL_LAYERS_VISIBLE);
  const { data: markups } = usePreconMarkups(sessionId);
  // two drawn points whose real distance the reviewer is about to type
  const [scalePrompt, setScalePrompt] = useState<ScalePrompt | null>(null);
  // a finished shape waiting for its name
  const [pending, setPending] = useState<PendingMeasurement | null>(null);
  // Measuring tools draw a new line by default; redrawing the selected line
  // is an explicit choice from the status bar, never a side effect of having
  // a line selected (the line just created is selected, for one).
  const [redrawTargetId, setRedrawTargetId] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);
  const [legendGroup, setLegendGroup] = useState<string | null>(null);
  const [flashRowId, setFlashRowId] = useState<string | null>(null);
  const [magnifierSticky, setMagnifierSticky] = useState(false);
  const magnifierHeld = useMagnifierHold();
  const tools = useViewerTools({ sessionId, activeSheet, onToolChange, draft: draftApi, setPending, setNote });

  // A sheet change drops any half-drawn shape, prompt, matches and legend pick.
  const [draftSheetId, setDraftSheetId] = useState(activeSheet?.id ?? null);
  if (draftSheetId !== (activeSheet?.id ?? null)) {
    setDraftSheetId(activeSheet?.id ?? null);
    draftApi.clear();
    setScalePrompt(null);
    setLegendGroup(null);
    tools.reset();
  }

  const updateGeometry = useUpdatePreconGeometry(sessionId);
  const addDeduction = useAddPreconDeduction(sessionId);
  const updateSheet = useUpdatePreconSheet(sessionId);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const sheetGeometries = useMemo(() => geometries.filter((g) => g.sheetId === activeSheet?.id), [geometries, activeSheet?.id]);
  const sheetMarkups = useMemo(() => (markups ?? []).filter((m) => m.preconSheetId === activeSheet?.id), [markups, activeSheet?.id]);
  // what each toggle would hide, so turning a layer off says what went with it
  const layerCounts = useMemo(
    () => ({
      measurements: sheetGeometries.length,
      ink: sheetMarkups.filter((m) => m.kind === MARKUP_KIND.PEN).length,
      comments: sheetMarkups.filter((m) => m.kind === MARKUP_KIND.PIN).length,
    }),
    [sheetGeometries, sheetMarkups],
  );
  const legendEntries = useMemo(() => buildLegendEntries(sheetGeometries, rowById), [sheetGeometries, rowById]);
  const elementGroups = useMemo(() => [...new Set(rows.flatMap((r) => (r.elementGroup ? [r.elementGroup] : [])))], [rows]);
  // What reads at full strength: a line just created, a legend group, or the
  // line being reviewed. Everything else fades so the selection carries.
  const emphasisRowIds = useMemo(() => {
    if (flashRowId) return new Set([flashRowId]);
    if (legendGroup) return new Set(legendEntries.find((entry) => entry.group === legendGroup)?.rowIds ?? []);
    if (selectedRowId) return new Set([selectedRowId]);
    return null;
  }, [flashRowId, legendGroup, legendEntries, selectedRowId]);

  const selectedRow = selectedRowId ? (rowById.get(selectedRowId) ?? null) : null;
  const meta = PRECON_TOOL_BY_KEY[tool];
  const viewports = activeSheet?.viewports ?? [];
  const draftViewport = viewportAt(viewports, draft[0]);
  const blockedFor = (m: PreconToolMeta) => blockedReasonFor(m, activeSheet, selectedRow);
  const drawingEnabled = tool !== "select" && !blockedFor(meta);
  const calibratingViewport = tools.viewportDraft?.mode === "points" && tools.viewportDraft.ptLength === null;
  const dragEnabled = drawingEnabled && DRAG_TOOLS.has(tool) && !pending && !scalePrompt && !tools.viewportDraft && !tools.matches;

  const changeTool = (next: PreconTool) => {
    if (next === "overlay") return tools.toggleOverlay();
    if (next === "magnifier") return setMagnifierSticky((on) => !on);
    draftApi.clear();
    dragRect.cancel();
    setPending(null);
    setScalePrompt(null);
    setNote(null);
    tools.reset();
    onToolChange(next);
  };

  const finishDraft = (vertices: number[][] = draft) => {
    if (tool === "scale") {
      if (vertices.length >= 2) setScalePrompt({ ptLength: Math.hypot(vertices[1]![0]! - vertices[0]![0]!, vertices[1]![1]! - vertices[0]![1]!), mm: "" });
      return;
    }
    if (vertices.length === 0) return;
    const measure = meta.measure;
    const redrawing = Boolean(selectedRow && redrawTargetId === selectedRow.id);
    if (measure && !redrawing) {
      // draw first, name after: the shape stays on the sheet while the composer names it
      if (vertices.length >= MEASURE_MIN_VERTICES[measure]) setPending({ tool: measure, vertices });
      else setNote(`Add at least ${MEASURE_MIN_VERTICES[measure]} points before finishing.`);
      return;
    }
    if (!selectedRow) return draftApi.clear();
    const onError = (error: unknown) =>
      setNote(isVersionConflict(error) ? "Row changed elsewhere — refreshed; redraw to apply." : getApiErrorMessage(error, "Measurement failed"));
    const base = { rowId: selectedRow.id, version: selectedRow.version, sheetId: activeSheet?.id };
    if (tool === "deduct" && vertices.length >= 3) addDeduction.mutate({ ...base, label: "Opening (manual)", vertices }, { onError });
    else if (measure && vertices.length >= MEASURE_MIN_VERTICES[measure]) updateGeometry.mutate({ ...base, kind: MEASURE_GEOMETRY_KIND[measure], vertices }, { onError });
    draftApi.clear();
  };

  // Esc always returns to Select, dropping whatever was half-drawn.
  const cancel = () => {
    draftApi.clear();
    dragRect.cancel();
    setScalePrompt(null);
    setNote(null);
    setMagnifierSticky(false);
    tools.reset();
    if (tool !== "select") onToolChange("select");
  };

  useToolShortcuts(
    {
      onEscape: cancel,
      onEnter: () => {
        if (tools.matches) tools.confirmMatches();
        else if (!scalePrompt && !tools.viewportDraft) finishDraft();
      },
      onTool: (next) => {
        // Z is a hold (useMagnifierHold); the palette button makes it sticky
        if (next === "magnifier") return;
        if (!blockedFor(PRECON_TOOL_BY_KEY[next])) changeTool(next);
      },
      onToggleLegend: () => setLegendOpen((v) => !v),
    },
    !pending,
  );

  const applyDrawnScale = () => {
    if (!scalePrompt || !activeSheet) return;
    const mm = Number(scalePrompt.mm);
    if (!Number.isFinite(mm) || mm <= 0) return toast("Enter the real distance between the two points in millimetres.", "error");
    const mmPerPt = mm / scalePrompt.ptLength;
    updateSheet.mutate(
      { sheetId: activeSheet.id, input: { scaleMmPerPt: mmPerPt, dimUnit: "mm" } },
      {
        onSuccess: () => {
          toast(`Scale set to 1:${scaleRatioOf(mmPerPt)}. Re-measure the sheet from Sheet settings to redraw its lines.`, "success");
          setScalePrompt(null);
          draftApi.clear();
          onToolChange("select");
        },
        onError: (e) => toast(getApiErrorMessage(e, "Could not set the scale."), "error"),
      },
    );
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    if (dragRect.consumeClick()) return;
    if (!drawingEnabled || scalePrompt || pending || tools.matches || tools.searching) return;
    if (NON_DRAWING_TOOLS.has(tool) || (tool === "viewports" && !calibratingViewport)) return;
    const raw = screenToPt(e.clientX, e.clientY);
    if (!raw) return;
    if (tool === "room_fill") return tools.roomFillAt(raw);
    if (tool === "scale" && anchors.length >= 2) return;
    const last = draft[draft.length - 1] ?? null;
    const arcs = tool !== "scale" && tool !== "count" && tool !== "viewports";
    const next = draftApi.addPoint(snapAndOrtho(raw, e.shiftKey, last), arcs && e.altKey);
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

  const onCreated = (row: PreconBoqRow) => {
    draftApi.clear();
    setRedrawTargetId(null);
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
  const magnifierOn = (magnifierHeld || magnifierSticky) && Boolean(page);
  const overlaySheet = tools.overlayOn && tools.previous.status === "ready" ? tools.previous.sheet : null;
  // The composer previews with the scale the backend will use: the viewport's when the shape starts in one.
  const composerSheet = activeSheet && pending ? { ...activeSheet, scaleMmPerPt: scaleForDraft(activeSheet.scaleMmPerPt, viewports, pending.vertices) } : activeSheet;

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-white">
      <SheetToolbar sheets={sheets} activeSheet={activeSheet} onSelectSheet={onSelectSheet} settingsOpen={settingsOpen} onToggleSettings={() => setSettingsOpen((v) => !v)} />

      {activeSheet && !scalePrompt && !tools.viewportDraft && !tools.matches ? (
        <SheetStatusBar
          sheet={activeSheet}
          tool={tool}
          selectedRow={selectedRow}
          redrawing={Boolean(selectedRow && redrawTargetId === selectedRow.id)}
          onToggleRedraw={() => setRedrawTargetId((current) => (selectedRow && current !== selectedRow.id ? selectedRow.id : null))}
          drawingEnabled={drawingEnabled}
          draft={draft}
          viewport={draftViewport}
        />
      ) : null}
      {activeSheet && !activeSheet.scaleMmPerPt && !scalePrompt && !tools.viewportDraft ? (
        <NoScaleBanner message={activeSheet.error ?? "No calibrated scale on this sheet."} onOpenSettings={() => setSettingsOpen(true)} onDrawScale={() => changeTool("scale")} />
      ) : null}
      {scalePrompt ? (
        <ScalePromptBanner prompt={scalePrompt} saving={updateSheet.isPending} onChange={(mm) => setScalePrompt({ ...scalePrompt, mm })} onApply={applyDrawnScale} onRedraw={() => setScalePrompt(null)} />
      ) : null}
      {tools.viewportDraft ? (
        <ViewportPromptBanner draft={tools.viewportDraft} saving={tools.savingViewport} onChange={(patch) => {
            if (patch.mode || patch.ptLength === null) draftApi.clear();
            tools.patchViewport(patch);
          }} onSave={tools.saveViewport} onDiscard={() => changeTool("select")} />
      ) : null}
      {tools.matches ? <SymbolMatchesBanner matches={tools.matches} onConfirm={tools.confirmMatches} onDiscard={() => changeTool("select")} /> : null}
      {tools.overlayOn && tools.previous.status === "ready" ? (
        <p className="border-b border-red-100 bg-red-50 px-3 py-1 text-xs text-red-700">
          Overlay: the previous revision{tools.previous.revision ? ` (rev ${tools.previous.revision})` : ""} in red under this sheet. O to hide.
        </p>
      ) : null}
      {banner ? <p className="border-b border-amber-100 bg-amber-50 px-3 py-1 text-xs text-amber-700">{banner}</p> : null}

      <div className="flex min-h-0 flex-1">
        <ToolPalette tool={tool} onToolChange={changeTool} blockedReasonFor={blockedFor} legendOpen={legendOpen} onToggleLegend={() => setLegendOpen((v) => !v)} toggles={{ overlay: tools.overlayOn, magnifier: magnifierSticky }} />
        <div
          ref={containerRef}
          className={cn("relative min-h-0 flex-1 overflow-hidden bg-gray-100", tool === "select" ? "cursor-grab" : magnifierOn ? "cursor-none" : "cursor-crosshair")}
          onMouseDown={(e) => {
            onMouseDown(e);
            if (dragEnabled) dragRect.begin(e);
          }}
          onMouseMove={(e) => {
            onMouseMove(e);
            dragRect.move(e);
          }}
          onMouseUp={() => {
            endPan();
            const box = dragRect.end();
            if (box) onDragEnd(box);
          }}
          onMouseLeave={() => {
            endPan();
            dragRect.cancel();
          }}
          onClick={onCanvasClick}
          onDoubleClick={() => finishDraft()}
        >
          {rendering || tools.searching || (tools.overlayOn && tools.previous.status === "loading") ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <Spinner size="md" />
            </div>
          ) : null}
          <div className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${cssZoom})`, transformOrigin: "0 0" }}>
            <SheetLayers
              canvasRef={canvasRef}
              page={page}
              sheet={{ sessionId, sheetId: activeSheet?.id ?? "", toPx, toPt, cssZoom }}
              tool={tool}
              layers={layers}
              rows={{ geometries: sheetGeometries, rowById, selectedRowId, emphasisRowIds, onSelectRow }}
              draft={{ vertices: draft, anchors, arcMid }}
              viewports={viewports}
              dragRect={dragRect.rect}
              overlay={overlaySheet ? { sheet: overlaySheet, sheets: tools.previous.sheets, onError: setNote } : null}
              matches={tools.matches}
              onToggleMatch={tools.onToggleMatch}
              onRemoveViewport={tools.removeViewport}
              onDone={() => onToolChange("select")}
            />
          </div>
          {magnifierOn ? <Magnifier containerRef={containerRef} canvasRef={canvasRef} screenToCanvas={screenToCanvas} cssZoom={cssZoom} /> : null}
          <SheetLegend entries={legendEntries} open={legendOpen} onToggle={() => setLegendOpen((v) => !v)} activeGroup={legendGroup} onPickGroup={setLegendGroup} />
          <LayerToggles layers={layers} counts={layerCounts} onToggle={(layer: SheetLayer) => setLayers((current) => ({ ...current, [layer]: !current[layer] }))} />
          <ZoomControls userZoom={view.userZoom} onZoomBy={zoomBy} onFit={zoomFit} />
          {settingsOpen && activeSheet ? (
            <SheetSettings key={activeSheet.id} sessionId={sessionId} sheet={activeSheet} onClose={() => setSettingsOpen(false)} onDrawScale={() => {
                setSettingsOpen(false);
                changeTool("scale");
              }} />
          ) : null}
          {tool === "typical" && selectedRow ? <TypicalPopover key={selectedRow.id} sessionId={sessionId} row={selectedRow} onClose={() => onToolChange("select")} /> : null}
        </div>
      </div>

      {pending && composerSheet ? (
        <MeasurementComposer sessionId={sessionId} sheet={composerSheet} pending={pending} elementGroups={elementGroups} onClose={() => {
            setPending(null);
            draftApi.clear();
          }} onCreated={onCreated} />
      ) : null}
    </div>
  );
}
PreconSheetViewer.displayName = "PreconSheetViewer";

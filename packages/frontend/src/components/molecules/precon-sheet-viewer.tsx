import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/atoms/spinner";
import { cn } from "@/lib/utils";
import type { PreconBoqRow, PreconGeometry, PreconSheet } from "@/api/precon";
import { usePreconSnapIndex } from "@/hooks/use-precon";
import { PRECON_TOOL_BY_KEY, type PreconTool, type PreconToolMeta } from "@/lib/precon-meta";
import { SheetToolbar } from "./precon-sheet-viewer/sheet-toolbar";
import { SheetLegend } from "./precon-sheet-viewer/sheet-legend";
import { SheetSettings } from "./precon-session/sheet-settings";
import { useSheetView, useSpaceHold } from "./precon-sheet-viewer/use-sheet-view";
import { fitViewFor } from "./precon-sheet-viewer/fit-view";
import { useSheetLoader, type PageInfo } from "./precon-sheet-viewer/use-sheet-loader";
import { useSheetCoords } from "./precon-sheet-viewer/use-sheet-coords";
import { ToolPalette } from "./precon-sheet-viewer/tool-palette";
import { ZoomControls } from "./precon-sheet-viewer/zoom-controls";
import { useViewerKeyboard } from "./precon-sheet-viewer/use-viewer-keyboard";
import { MeasurementComposer, type PendingMeasurement } from "./precon-sheet-viewer/measurement-composer";
import { MEASURE_MIN_VERTICES } from "./precon-sheet-viewer/measure-maths";
import { rectOf, scaleForDraft, viewportAt } from "./precon-sheet-viewer/draft-maths";
import { segmentReadout } from "./precon-sheet-viewer/saved-edit-model";
import { polygonSelfIntersects } from "./precon-sheet-viewer/polygon-validity";
import { MeasurementInspector } from "./precon-sheet-viewer/measurement-inspector";
import { useSheetChangeReset } from "./precon-sheet-viewer/use-sheet-change-reset";
import { useSelectInteractions } from "./precon-sheet-viewer/use-select-interactions";
import { useBatchWiring } from "./precon-sheet-viewer/use-batch-wiring";
import { BatchActionBar } from "./precon-sheet-viewer/batch-action-bar";
import { SavedEditOverlays } from "./precon-sheet-viewer/saved-edit-overlays";
import { useDrawActions } from "./precon-sheet-viewer/use-draw-actions";
import { useSavedEdit } from "./precon-sheet-viewer/use-saved-edit";
import { useOpHistory } from "./precon-sheet-viewer/use-op-history";
import { CanvasControlBars } from "./precon-sheet-viewer/canvas-control-bars";
import { CanvasBottomDock } from "./precon-sheet-viewer/canvas-bottom-dock";
import { ViewerPreviewPanels } from "./precon-sheet-viewer/viewer-preview-panels";
import { curvedShapeResolver, measuringGeometryResolver, savedEditLayerProps } from "./precon-sheet-viewer/viewer-resolvers";
import { PenPresets } from "./precon-sheet-viewer/pen-presets";
import { useDraft, useDragRect } from "./precon-sheet-viewer/use-draft";
import { useViewerTools } from "./precon-sheet-viewer/use-viewer-tools";
import { blockedReasonFor } from "./precon-sheet-viewer/tool-availability";
import { Magnifier, useMagnifierHold } from "./precon-sheet-viewer/magnifier";
import { TypicalPopover } from "./precon-sheet-viewer/typical-popover";
import { SheetLayers } from "./precon-sheet-viewer/sheet-layers";
import { DiscardDraftDialog, useDiscardGuard } from "./precon-sheet-viewer/discard-guard";
import { ViewerBanners } from "./precon-sheet-viewer/viewer-banners";
import { usePreconMarkups } from "@/hooks/use-precon-markups";
import { useScalePrompt } from "./precon-sheet-viewer/use-scale-prompt";
import { useSheetDerived } from "./precon-sheet-viewer/use-sheet-derived";
import { ALL_LAYERS_VISIBLE, LayerToggles, type SheetLayer } from "./precon-sheet-viewer/layer-toggles";

export type { PreconTool };

// Stacked under lg (the bill sits beneath the sheet rather than beside it): the
// sheet sticks to the top of the scrolling column and keeps a height it can be
// measured on, so picking a bill line never scrolls away the drawing it marks.
const VIEWER_SHELL =
  "flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-white max-lg:sticky max-lg:top-0 max-lg:z-20 max-lg:h-[32rem]";

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

/**
 * The sheet canvas with its palette. With no bill line selected the measuring
 * tools draw a new line (draw first, name after); with one selected they
 * redraw it. Vertices are sheet points in both cases.
 */
export function PreconSheetViewer({ sessionId, sheets, activeSheet, onSelectSheet, geometries, rows, selectedRowId, onSelectRow, tool, onToolChange, zoomRequest, focusGeometry = null, onMeasurementCreated, shortcutsEnabled = true }: PreconSheetViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const spaceHeld = useSpaceHold();
  const { view, setView, zoomBy, onMouseDown, onMouseMove, endPan } = useSheetView(containerRef, tool === "select" || spaceHeld);
  const pageRef = useRef<PageInfo | null>(null);
  const fitView = useCallback(() => setView(fitViewFor(pageRef.current, containerRef.current?.getBoundingClientRect() ?? null)), [setView]);
  const fitLoaded = useCallback(
    (loaded: PageInfo | null) => {
      pageRef.current = loaded;
      fitView();
    },
    [fitView],
  );
  const { page, rendering, loadError } = useSheetLoader({ canvasRef, activeSheet, sheets, userZoom: view.userZoom, onLoaded: fitLoaded });
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  const { data: snapPoints = [] } = usePreconSnapIndex(activeSheet?.id ?? null);
  const { cssZoom, toPx, toPt, screenToCanvas, screenToPt, snapAndOrtho, screenPxToPt } = useSheetCoords({ page, view, containerRef, snapPoints });

  const draftApi = useDraft();
  const { draft, anchors, arcMid } = draftApi;
  const dragRect = useDragRect(screenToPt);
  const [note, setNote] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layers, setLayers] = useState(ALL_LAYERS_VISIBLE);
  const { data: markups } = usePreconMarkups(sessionId);
  // a finished shape waiting for its name
  const [pending, setPending] = useState<PendingMeasurement | null>(null);
  // Redrawing the selected line is an explicit status-bar choice, never a side
  // effect of a selection (the line just created is selected, for one).
  const [redrawTargetId, setRedrawTargetId] = useState<string | null>(null);
  // A narrow canvas is mostly legend if it opens expanded, so it starts folded
  // there; the toggle is unchanged and still reachable at every width.
  const [legendOpen, setLegendOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 1024);
  // The blocked tool last tried: the palette refuses and says why, on screen.
  const [blockedAttempt, setBlockedAttempt] = useState<{ toolLabel: string; reason: string } | null>(null);
  const [legendGroup, setLegendGroup] = useState<string | null>(null);
  const [flashRowId, setFlashRowId] = useState<string | null>(null);
  const [magnifierSticky, setMagnifierSticky] = useState(false);
  const magnifierHeld = useMagnifierHold();
  const tools = useViewerTools({ sessionId, activeSheet, tool, onToolChange, draft: draftApi, geometries, setPending, setNote });
  const scale = useScalePrompt({ sessionId, activeSheet, onApplied: () => { draftApi.clear(); onToolChange("select"); } }); // drawn reference calibration
  const scalePrompt = scale.prompt;
  const { rowById, sheetGeometries, visibleGeometries, layerCounts, legendEntries, elementGroups, emphasisRowIds, hiddenGroups, toggleHiddenGroup } = useSheetDerived({
    geometries,
    rows,
    markups,
    activeSheetId: activeSheet?.id ?? null,
    flashRowId,
    legendGroup,
    selectedRowId,
  });

  const selectedRow = selectedRowId ? (rowById.get(selectedRowId) ?? null) : null;
  const meta = PRECON_TOOL_BY_KEY[tool];
  const viewports = activeSheet?.viewports ?? [];
  const draftViewport = viewportAt(viewports, draft[0]);
  const blockedFor = (m: PreconToolMeta) => blockedReasonFor(m, activeSheet, selectedRow);
  const drawingEnabled = tool !== "select" && !blockedFor(meta);
  const activeBlockedReason = tool === "select" ? null : blockedFor(meta);
  const activeBlockedNotice = activeBlockedReason ? { toolLabel: meta.label, reason: activeBlockedReason } : null;
  const calibratingViewport = tools.viewportDraft?.mode === "points" && tools.viewportDraft.ptLength === null;
  // Half-drawn work a switch would silently destroy — what the discard prompt guards.
  const dirtyDraft = draft.length > 0 || arcMid !== null;
  const shapeOf = curvedShapeResolver(rowById, geometries);
  const savedEdit = useSavedEdit(sessionId, { shapeFor: shapeOf, versionOf: (rowId) => rowById.get(rowId)?.version ?? null });
  const [areaShape, setAreaShape] = useState<"polygon" | "rectangle">("polygon");
  const [arcMode, setArcMode] = useState(false);
  const rectangleMode = tool !== "area" && tool !== "volume" ? true : areaShape === "rectangle";
  const dragEnabled = drawingEnabled && DRAG_TOOLS.has(tool) && rectangleMode && !pending && !scalePrompt && !tools.viewportDraft && !tools.detectionActive;
  useSheetChangeReset(activeSheet?.id ?? null, () => {
    draftApi.clear(); savedEdit.cancel(); scale.clear();
    setLegendGroup(null); setBlockedAttempt(null); tools.reset();
  });
  if (savedEdit.edit && savedEdit.edit.rowId !== selectedRowId) savedEdit.cancel(); // stale-line edit reconcile
  const dirtyWork = dirtyDraft || savedEdit.dirty;

  const performToolChange = (next: PreconTool) => {
    draftApi.clear(); savedEdit.cancel(); dragRect.cancel(); setPending(null);
    scale.clear(); setNote(null); setBlockedAttempt(null); tools.reset();
    onToolChange(next);
  };

  const guard = useDiscardGuard({
    dirty: dirtyWork,
    activeSheetId: activeSheet?.id ?? null,
    applyTool: performToolChange,
    applySheet: (sheetId) => { draftApi.clear(); savedEdit.cancel(); onSelectSheet(sheetId); },
  });

  const changeTool = (next: PreconTool) => {
    if (next === "overlay") return tools.toggleOverlay();
    if (next === "magnifier") return setMagnifierSticky((on) => !on);
    if (next === tool) return performToolChange(next);
    guard.requestTool(next);
  };

  const opHistory = useOpHistory({ sessionId, sheetId: activeSheet?.id ?? null, rowById });
  const bw = useBatchWiring({ sessionId, sheetGeometries, rowById, mmPerPt: activeSheet?.scaleMmPerPt ?? null, onSelectRow, setNote, screenToPt, screenPxToPt, cssZoom });
  const select = useSelectInteractions({ tool, savedEdit, containerRef, selectedRowId, onSelectRow, sheetGeometries, screenToPt, snapAndOrtho, toPx, cssZoom, view, setView });
  const editGeometry = savedEdit.edit ? (sheetGeometries.find((g) => g.id === savedEdit.edit!.geometryId) ?? null) : null;
  const editScale = savedEdit.edit ? scaleForDraft(activeSheet?.scaleMmPerPt ?? null, viewports, savedEdit.edit.vertices) : null;
  const { finishDraft, finishFromDoubleClick, onCanvasClick, onDragEnd } = useDrawActions({
    sessionId, tool, activeSheet, selectedRow, redrawTargetId, drawingEnabled, calibratingViewport,
    nonDrawingTools: NON_DRAWING_TOOLS, scalePrompt, pending, draftApi, dragRect, tools,
    screenToPt, snapAndOrtho, setPending, setNote, startScale: scale.start, areaShape, arcMode, screenPxToPt, measuringGeometryIdFor: measuringGeometryResolver(sheetGeometries),
  });

  const cancel = useViewerKeyboard({
    tool, onToolChange, changeTool, toolBlockedReason: (t) => blockedFor(PRECON_TOOL_BY_KEY[t]),
    selectedRowId, onSelectRow, guard, scale, tools, draftApi, dragRect, savedEdit, opHistory, batch: bw,
    dirtyDraft, enabled: shortcutsEnabled && !pending && !guard.pending, finishDraft,
    clearNote: () => setNote(null),
    releaseMagnifier: () => setMagnifierSticky(false),
    onToggleLegend: () => setLegendOpen((v) => !v),
  });

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
    else fitView();
  }, [zoomRequest, zoomBy, fitView]);

  // Frame the chosen annotation once the sheet holding it has rendered. Keyed
  // on `seq` as well as the id, so picking the same shape twice re-frames it.
  // `select` is deliberately out of the deps: it is rebuilt every render, so
  // including it would re-frame continuously and fight the user's own panning.
  useEffect(() => {
    if (!focusGeometry) return;
    if (!sheetGeometries.some((g) => g.id === focusGeometry.geometryId)) return;
    select.zoomToGeometry(focusGeometry.geometryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusGeometry?.seq, focusGeometry?.geometryId, sheetGeometries]);

  const magnifierOn = (magnifierHeld || magnifierSticky) && Boolean(page);
  const overlaySheet = tools.overlayOn && tools.previous.status === "ready" ? tools.previous.sheet : null;
  // The composer previews with the scale the backend will use: the viewport's when the shape starts in one.
  const composerSheet = activeSheet && pending ? { ...activeSheet, scaleMmPerPt: scaleForDraft(activeSheet.scaleMmPerPt, viewports, pending.vertices) } : activeSheet;
  const minForTool = tool === "scale" ? 2 : meta.measure ? MEASURE_MIN_VERTICES[meta.measure] : null;
  const polygonalDraft = (tool === "area" || tool === "volume") && areaShape === "polygon";
  const selfCrossWarning = polygonalDraft && anchors.length >= 3 && polygonSelfIntersects(draft) ? "The outline crosses itself — move a point before closing." : null;
  const finishBlockedReason = selfCrossWarning ?? (minForTool !== null && anchors.length < minForTool ? `Add at least ${minForTool} point${minForTool === 1 ? "" : "s"} first` : null);
  const closeHint = polygonalDraft && anchors.length >= 3 && !selfCrossWarning ? (anchors[0] ?? null) : null;
  const draftControlsOn = drawingEnabled && (dirtyDraft || tool === "area" || tool === "volume") && !pending && !scalePrompt && !tools.viewportDraft && !tools.detectionActive;

  return (
    <div data-takeoff-focus="true" className={VIEWER_SHELL}>
      <SheetToolbar sheets={sheets} activeSheet={activeSheet} onSelectSheet={guard.requestSheet} settingsOpen={settingsOpen} onToggleSettings={() => setSettingsOpen((v) => !v)} />

      <ViewerBanners
        activeSheet={activeSheet}
        tool={tool}
        selectedRow={selectedRow}
        redrawing={Boolean(selectedRow && redrawTargetId === selectedRow.id)}
        onToggleRedraw={() => setRedrawTargetId((current) => (selectedRow && current !== selectedRow.id ? selectedRow.id : null))}
        drawingEnabled={drawingEnabled}
        draft={draft}
        draftViewport={draftViewport}
        scale={scale}
        tools={tools}
        onClearDraft={draftApi.clear}
        onBackToSelect={() => changeTool("select")}
        onOpenSettings={() => setSettingsOpen(true)}
        onDrawScale={() => changeTool("scale")}
        notice={blockedAttempt ?? activeBlockedNotice}
        banner={selfCrossWarning ?? note ?? savedEdit.note ?? opHistory.note ?? loadError}
      />

      <div className="flex min-h-0 flex-1">
        <ToolPalette
          tool={tool}
          onToolChange={changeTool}
          blockedReasonFor={blockedFor}
          legendOpen={legendOpen}
          onToggleLegend={() => setLegendOpen((v) => !v)}
          toggles={{ overlay: tools.overlayOn, magnifier: magnifierSticky }}
          onBlockedAttempt={(m, reason) => setBlockedAttempt({ toolLabel: m.label, reason })}
        />
        <div
          ref={containerRef}
          className={cn("relative min-h-0 flex-1 overflow-hidden bg-gray-100", tool === "select" ? "cursor-grab" : magnifierOn ? "cursor-none" : "cursor-crosshair")}
          onMouseDown={(e) => {
            select.notePress(e);
            onMouseDown(e);
            if (dragEnabled || (tool === "select" && e.shiftKey)) dragRect.begin(e);
          }}
          onMouseMove={(e) => {
            onMouseMove(e);
            dragRect.move(e);
          }}
          onMouseUp={() => {
            endPan();
            const box = dragRect.end();
            if (box) (tool === "select" ? bw.batch.addRect(rectOf(box.start, box.current)) : onDragEnd(box));
          }}
          onMouseLeave={() => {
            endPan();
            dragRect.cancel();
          }}
          onClick={(e) => {
            if (spaceHeld) return; // a pan's trailing click must not place a point
            const raw = screenToPt(e.clientX, e.clientY);
            if (raw && (tools.ovl.captureClick(raw) || bw.captureCutClick(raw) || tools.detect.captureCanvasClick(raw))) return;
            if (!select.handleSelectClick(e)) onCanvasClick(e);
          }}
          onDoubleClick={finishFromDoubleClick}
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
              penStyle={tools.penStyle}
              layers={layers}
              rows={{ geometries: visibleGeometries, rowById, selectedRowId, emphasisRowIds, onSelectRow, batchIds: bw.batch.ids, onPickGeometry: tool === "select" ? bw.pickGeometry : undefined, onGeometryPointerDown: tool === "select" ? bw.startSelectionDrag : undefined, dragDeltaPx: bw.dragDeltaPx }}
              savedEdit={savedEditLayerProps({ active: tool === "select", selectedRowId, focusGeometryId: focusGeometry?.geometryId ?? null, sheetGeometries, savedEdit, select, screenToPt, shapeOf })}
              draft={{ vertices: draft, anchors, arcMid, closeHint }}
              viewports={viewports}
              dragRect={dragRect.rect}
              overlay={overlaySheet ? { sheet: overlaySheet, sheets: tools.previous.sheets, onError: setNote } : null}
              ovl={tools.ovl.render ? { model: tools.ovl.render, onError: setNote } : null}
              detection={{ room: tools.detect.room, template: tools.detect.template, review: tools.detect.review, screenToPt, onRoomVertex: tools.detect.roomMoveVertex, onToggleMatch: tools.detect.toggleMatch }}
              scaleEdit={scalePrompt ? { prompt: scalePrompt, screenToPt, onMovePoint: scale.movePoint } : null}
              onRemoveViewport={tools.removeViewport}
              onEditViewport={tools.startRegionEdit}
              regionEdit={tools.regionEdit ? { edit: tools.regionEdit, screenToPt, onRect: (rect) => tools.patchRegionEdit({ rect }) } : null}
              onDone={() => onToolChange("select")}
            />
          </div>
          {magnifierOn ? <Magnifier containerRef={containerRef} canvasRef={canvasRef} screenToCanvas={screenToCanvas} cssZoom={cssZoom} /> : null}
          <SheetLegend entries={legendEntries} open={legendOpen} onToggle={() => setLegendOpen((v) => !v)} activeGroup={legendGroup} onPickGroup={setLegendGroup} hiddenGroups={hiddenGroups} onToggleHidden={toggleHiddenGroup} onZoomGroup={select.zoomToRows} allRows={rows} selectionRowIds={new Set([...bw.batch.ids].map((gid) => sheetGeometries.find((g) => g.id === gid)?.rowId ?? "").filter(Boolean).concat(selectedRowId ? [selectedRowId] : []))} />
          <LayerToggles layers={layers} counts={layerCounts} onToggle={(layer: SheetLayer) => setLayers((current) => ({ ...current, [layer]: !current[layer] }))} />
          <SavedEditOverlays savedEdit={savedEdit} select={select} editScale={editScale} />
          <ViewerPreviewPanels scale={scale} tools={tools} onOpenRow={(rowId) => {
              scale.clear();
              performToolChange("select");
              onSelectRow(rowId);
            }} />
          {tool === "select" && bw.batch.active ? (
            <BatchActionBar batch={bw.batch} ops={bw.ops} rows={rows} sheets={sheets} activeSheet={activeSheet} rowById={rowById} onStartCut={bw.startCut} />
          ) : null}
          {tool === "select" && selectedRow && !bw.batch.active && !savedEdit.conflict && !savedEdit.edit?.addingAt ? (
            <MeasurementInspector sessionId={sessionId} row={selectedRow} sheet={activeSheet} rowGeometries={sheetGeometries.filter((g) => g.rowId === selectedRow.id && g.kind !== "deduction")} onLegacyConfirm={savedEdit.setConfirmation} legacyConfirmed={savedEdit.confirmation} />
          ) : null}
          <CanvasBottomDock
            bar={
              <>
                <CanvasControlBars
                  draftApi={draftApi}
                  savedEdit={savedEdit}
                  opHistory={opHistory}
                  draftControlsOn={draftControlsOn}
                  historyControlsOn={tool === "select" && !dirtyDraft}
                  finishBlockedReason={finishBlockedReason}
                  readout={drawingEnabled ? segmentReadout(draft, scaleForDraft(activeSheet?.scaleMmPerPt ?? null, viewports, draft)) : null}
                  areaShape={tool === "area" || tool === "volume" ? areaShape : null}
                  onAreaShape={setAreaShape}
                  arcMode={drawingEnabled && tool !== "scale" && tool !== "count" && tool !== "viewports" ? arcMode : null}
                  onArcMode={setArcMode}
                  editGeometry={editGeometry}
                  onFinish={() => finishDraft()}
                  onCancel={cancel}
                />
                {tool === "pen" ? <PenPresets style={tools.penStyle} onChange={tools.setPenStyle} /> : null}
              </>
            }
            view={<ZoomControls userZoom={view.userZoom} onZoomBy={zoomBy} onFit={fitView} onZoomSelection={tool === "select" && selectedRowId ? select.zoomToSelection : null} />}
          />
          {settingsOpen && activeSheet ? (
            <SheetSettings key={activeSheet.id} sessionId={sessionId} sheet={activeSheet} onClose={() => setSettingsOpen(false)} onDrawScale={() => {
                setSettingsOpen(false);
                changeTool("scale");
              }} />
          ) : null}
          {tool === "typical" && selectedRow ? <TypicalPopover key={selectedRow.id} sessionId={sessionId} row={selectedRow} onClose={() => onToolChange("select")} /> : null}
        </div>
      </div>

      <DiscardDraftDialog pending={guard.pending} onConfirm={guard.confirm} onDismiss={guard.dismiss} />

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

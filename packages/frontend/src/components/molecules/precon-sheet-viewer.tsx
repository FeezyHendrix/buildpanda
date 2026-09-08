import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// ?worker makes Vite emit the worker as a .js chunk and hand back a Worker
// constructor — static hosts that serve .mjs as octet-stream (staging nginx)
// break both workerSrc and the fake-worker fallback, so never fetch .mjs.
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";
import { Spinner } from "@/components/atoms/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import { Maximize2, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { preconApi, type PreconBoqRow, type PreconGeometry, type PreconSheet } from "@/api/precon";
import { isVersionConflict, useAddPreconDeduction, usePreconSnapIndex, useUpdatePreconGeometry, useUpdatePreconSheet } from "@/hooks/use-precon";
import { scaleRatioOf } from "@/lib/precon-meta";
import { toast } from "@/lib/toast";
import { SheetToolbar, type PreconTool } from "./precon-sheet-viewer/sheet-toolbar";
import { SheetOverlay } from "./precon-sheet-viewer/sheet-overlay";
import { SheetLegend } from "./precon-sheet-viewer/sheet-legend";
import { NoScaleBanner, ScalePromptBanner, type ScalePrompt } from "./precon-sheet-viewer/sheet-banners";
import { getElementStyle, type ElementStyle } from "./precon-sheet-viewer/element-styles";
import { SheetSettings } from "./precon-session/sheet-settings";
import { FIT_VIEW, useSheetView } from "./precon-sheet-viewer/use-sheet-view";

export type { PreconTool };

let sharedWorker: Worker | null = null;
const SNAP_PX = 10;
const BASE_RASTER = 1.5;
// a DWG is fitted to this many pixels wide at the base raster before zoom
const IMAGE_FIT_WIDTH_PX = 2400;

interface ViewerProps {
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
}

interface PageInfo {
  widthPx: number;
  heightPx: number;
  heightPt: number;
  rasterScale: number;
}

type PdfPageProxy = import("pdfjs-dist").PDFPageProxy;

function formatZoom(userZoom: number): string {
  return Number.isFinite(userZoom) ? String(Math.round(userZoom * 100)) : "100";
}

// The engine's SVG carries only a viewBox; give it explicit pixel dimensions
// so every browser reports a natural size and the canvas is never 0×0.
function sizedSvg(svg: string): string {
  const open = svg.match(/<svg\b[^>]*>/);
  if (!open || /\swidth=/.test(open[0])) return svg;
  const box = open[0].match(/viewBox="([^"]+)"/)?.[1]?.trim().split(/[\s,]+/).map(Number);
  if (!box || box.length !== 4 || !box.every(Number.isFinite) || box[2]! <= 0 || box[3]! <= 0) return svg;
  const width = IMAGE_FIT_WIDTH_PX;
  const height = Math.max(1, Math.round((width * box[3]!) / box[2]!));
  return svg.replace(open[0], open[0].replace(/<svg\b/, `<svg width="${width}" height="${height}"`));
}

/** Page number within the sheet's own PDF file (sheets are contiguous per file). */
function pageWithinFile(sheet: PreconSheet, sheets: PreconSheet[]): number {
  const siblings = [...sheets.filter((s) => s.fileName === sheet.fileName)].sort((a, b) => a.pageNumber - b.pageNumber);
  return siblings.findIndex((s) => s.id === sheet.id) + 1;
}

export function PreconSheetViewer({ sessionId, sheets, activeSheet, onSelectSheet, geometries, rows, selectedRowId, onSelectRow, tool, onToolChange, zoomRequest }: ViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PageInfo | null>(null);
  const [rendering, setRendering] = useState(false);
  const { view, setView, zoomBy, zoomFit, onMouseDown, onMouseMove, endPan } = useSheetView(containerRef, tool === "select");
  const [draft, setDraft] = useState<number[][]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // two drawn points whose real distance the reviewer is about to type
  const [scalePrompt, setScalePrompt] = useState<ScalePrompt | null>(null);

  const { data: snapPoints = [] } = usePreconSnapIndex(activeSheet?.id ?? null);
  const updateGeometry = useUpdatePreconGeometry(sessionId);
  const addDeduction = useAddPreconDeduction(sessionId);
  const updateSheet = useUpdatePreconSheet(sessionId);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const sheetGeometries = useMemo(() => geometries.filter((g) => g.sheetId === activeSheet?.id), [geometries, activeSheet?.id]);
  const presentStyles = useMemo(() => {
    const seen = new Map<string, ElementStyle>();
    for (const g of sheetGeometries) {
      const row = rowById.get(g.rowId);
      if (!row || row.status === "rejected") continue;
      const st = getElementStyle(row.elementGroup);
      if (!seen.has(st.label)) seen.set(st.label, st);
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [sheetGeometries, rowById]);

  // Rasterize a cached pdfjs page and publish the matching page-state in the
  // same pass, so toPx/toPt/cssZoom always agree with the pixels on the canvas.
  const rasterize = useCallback(async (pdfPage: PdfPageProxy, scale: number, isCancelled: () => boolean) => {
    const viewport = pdfPage.getViewport({ scale });
    const canvas = canvasRef.current;
    if (!canvas || isCancelled()) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
    if (isCancelled()) return;
    setPage({ widthPx: viewport.width, heightPx: viewport.height, heightPt: viewport.height / scale, rasterScale: scale });
  }, []);

  // A DWG sheet is served as SVG and drawn as an image. It shares the page
  // state with the PDF path so pan, zoom and the overlay maths stay identical:
  // "points" are image pixels at the base raster.
  const imageRef = useRef<{ sheetId: string; img: HTMLImageElement } | null>(null);
  const rasterizeImage = useCallback((img: HTMLImageElement, scale: number, isCancelled: () => boolean) => {
    const canvas = canvasRef.current;
    if (!canvas || isCancelled() || !Number.isFinite(scale) || scale <= 0) return;
    const fit = IMAGE_FIT_WIDTH_PX / Math.max(1, img.naturalWidth);
    const widthPx = Math.round(img.naturalWidth * fit * (scale / BASE_RASTER));
    const heightPx = Math.round(img.naturalHeight * fit * (scale / BASE_RASTER));
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, widthPx, heightPx);
    ctx.drawImage(img, 0, 0, widthPx, heightPx);
    setPage({ widthPx, heightPx, heightPt: heightPx / scale, rasterScale: scale });
  }, []);

  const [activeRasterScale, setActiveRasterScale] = useState(BASE_RASTER);
  const targetRasterScale = Math.min(4.5, BASE_RASTER * Math.max(1, Math.ceil(Number.isFinite(view.userZoom) ? view.userZoom : 1)));
  useEffect(() => {
    if (targetRasterScale === activeRasterScale) return;
    const timer = setTimeout(() => setActiveRasterScale(targetRasterScale), 200);
    return () => clearTimeout(timer);
  }, [targetRasterScale, activeRasterScale]);

  // The loaded pdfjs page is cached per sheet so zoom re-rasters redraw from
  // memory instead of re-downloading the whole PDF.
  const pdfPageRef = useRef<{ sheetId: string; page: PdfPageProxy } | null>(null);
  useEffect(() => {
    if (!activeSheet) return;
    let cancelled = false;
    const sheetId = activeSheet.id;
    setDraft([]);
    setScalePrompt(null);
    setActiveRasterScale(BASE_RASTER);
    setRendering(true);
    // A DWG is drawn from the engine's own parse, served as SVG.
    if (/\.dwg$/i.test(activeSheet.fileName)) {
      pdfPageRef.current = null;
      (async () => {
        const res = await fetch(preconApi.sheetSvgUrl(sheetId), { credentials: "include" });
        if (!res.ok) throw new Error(res.status === 404 ? "Nothing drawable in this DWG's model space" : `SVG ${res.status}`);
        const svg = sizedSvg(await res.text());
        if (cancelled) return;
        const img = new Image();
        const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("The drawing could not be decoded"));
          img.src = url;
        });
        URL.revokeObjectURL(url);
        if (cancelled) return;
        imageRef.current = { sheetId, img };
        rasterizeImage(img, BASE_RASTER, () => cancelled);
        setView(FIT_VIEW);
        setRendering(false);
      })().catch((error: unknown) => {
        if (!cancelled) {
          setRendering(false);
          setNote(`Could not render this drawing: ${(error instanceof Error ? error.message : String(error)).slice(0, 160)}`);
        }
      });
      return () => {
        cancelled = true;
      };
    }
    imageRef.current = null;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      if (!sharedWorker) sharedWorker = new PdfWorker();
      pdfjs.GlobalWorkerOptions.workerPort = sharedWorker;
      const doc = await pdfjs.getDocument({ url: preconApi.sheetFileUrl(sheetId), withCredentials: true }).promise;
      if (cancelled) return;
      const pdfPage = await doc.getPage(pageWithinFile(activeSheet, sheets));
      if (cancelled) return;
      pdfPageRef.current = { sheetId, page: pdfPage };
      await rasterize(pdfPage, BASE_RASTER, () => cancelled);
      if (cancelled) return;
      setView(FIT_VIEW);
      setRendering(false);
    })().catch((error: unknown) => {
      if (!cancelled) {
        setRendering(false);
        setNote(`Could not render this sheet: ${(error instanceof Error ? error.message : String(error)).slice(0, 160)}`);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheet?.id]);

  useEffect(() => {
    if (!activeSheet || !page || page.rasterScale === activeRasterScale) return;
    const image = imageRef.current;
    if (image && image.sheetId === activeSheet.id) {
      rasterizeImage(image.img, activeRasterScale, () => false);
      return;
    }
    const cached = pdfPageRef.current;
    if (!cached || cached.sheetId !== activeSheet.id) return;
    let cancelled = false;
    void rasterize(cached.page, activeRasterScale, () => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRasterScale, activeSheet?.id]);

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

  const selectedRow = selectedRowId ? rowById.get(selectedRowId) : null;
  const blockedReasonFor = (t: PreconTool): string | null => {
    if (!activeSheet) return "Open a sheet first";
    if (t === "scale") return null;
    if (!activeSheet.scaleMmPerPt) return "Set this sheet's scale first (Sheet → scale, or the Set scale tool)";
    if (!selectedRow) return "Select a BOQ item on the right to measure into";
    return null;
  };
  const drawingEnabled = tool !== "select" && !blockedReasonFor(tool);

  const commitDraft = () => {
    if (tool === "scale") {
      if (draft.length >= 2) setScalePrompt({ ptLength: Math.hypot(draft[1]![0]! - draft[0]![0]!, draft[1]![1]! - draft[0]![1]!), mm: "" });
      return;
    }
    if (!selectedRow || draft.length === 0) {
      setDraft([]);
      return;
    }
    const onError = (error: unknown) =>
      setNote(isVersionConflict(error) ? "Row changed elsewhere — refreshed; redraw to apply." : getApiErrorMessage(error, "Measurement failed"));
    const base = { rowId: selectedRow.id, version: selectedRow.version, sheetId: activeSheet?.id };
    if (tool === "deduct" && draft.length >= 3) addDeduction.mutate({ ...base, label: "Opening (manual)", vertices: draft }, { onError });
    else if (tool === "area" && draft.length >= 3) updateGeometry.mutate({ ...base, kind: "area", vertices: draft }, { onError });
    else if (tool === "linear" && draft.length >= 2) updateGeometry.mutate({ ...base, kind: "linear", vertices: draft }, { onError });
    else if (tool === "count" && draft.length >= 1) updateGeometry.mutate({ ...base, kind: "count", vertices: draft }, { onError });
    setDraft([]);
  };

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDraft([]);
        setScalePrompt(null);
      }
      if (e.key === "Enter" && !scalePrompt) commitDraft();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, tool, selectedRowId, scalePrompt]);

  const onCanvasClick = (e: React.MouseEvent) => {
    if (!drawingEnabled || scalePrompt) return;
    const canvasPt = screenToCanvas(e.clientX, e.clientY);
    if (!canvasPt) return;
    const pdfPt = toPt(canvasPt[0], canvasPt[1]);
    setDraft((prev) => (tool === "scale" && prev.length >= 2 ? prev : [...prev, applySnapAndOrtho(pdfPt, e.shiftKey)]));
  };
  useEffect(() => {
    if (!zoomRequest) return;
    if (zoomRequest.kind === "in") zoomBy(1.5);
    else if (zoomRequest.kind === "out") zoomBy(1 / 1.5);
    else zoomFit();
  }, [zoomRequest, zoomBy, zoomFit]);


  const statusLine = !activeSheet
    ? null
    : scalePrompt
      ? null
      : activeSheet.scaleMmPerPt
        ? `1:${scaleRatioOf(activeSheet.scaleMmPerPt)} · dims in ${activeSheet.dimUnit ?? "mm"} · ${activeSheet.scaleConfidence === 1 ? "scale set by reviewer" : `calibration ${Math.round((activeSheet.scaleConfidence ?? 0) * 100)}%`}${tool === "scale" ? " — click two points a known distance apart, then Enter" : tool !== "select" && !selectedRow ? " — select a BOQ item to measure into" : drawingEnabled ? " — click to add points, Enter to finish, Esc to cancel, Shift for ortho" : ""}`
        : null;

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      <SheetToolbar
        sheets={sheets}
        activeSheet={activeSheet}
        onSelectSheet={onSelectSheet}
        tool={tool}
        onToolChange={(t) => {
          setDraft([]);
          setScalePrompt(null);
          onToolChange(t);
        }}
        blockedReasonFor={blockedReasonFor}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
      />

      {statusLine ? <p className="border-b border-gray-100 px-3 py-1 text-[11px] text-gray-400">{statusLine}</p> : null}
      {activeSheet && !activeSheet.scaleMmPerPt && !scalePrompt ? (
        <NoScaleBanner
          message={activeSheet.error ?? "No calibrated scale on this sheet."}
          onOpenSettings={() => setSettingsOpen(true)}
          onDrawScale={() => onToolChange("scale")}
        />
      ) : null}
      {scalePrompt ? (
        <ScalePromptBanner
          prompt={scalePrompt}
          saving={updateSheet.isPending}
          onChange={(mm) => setScalePrompt({ ...scalePrompt, mm })}
          onApply={applyDrawnScale}
          onRedraw={() => setScalePrompt(null)}
        />
      ) : null}
      {note ? <p className="border-b border-amber-100 bg-amber-50 px-3 py-1 text-[11px] text-amber-700">{note}</p> : null}

      <div
        ref={containerRef}
        className={cn("relative min-h-0 flex-1 overflow-hidden bg-gray-100", tool === "select" ? "cursor-grab" : "cursor-crosshair")}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
        onClick={onCanvasClick}
        onDoubleClick={commitDraft}
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
            />
          ) : null}
        </div>
        <SheetLegend styles={presentStyles} />
        <div
          className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" aria-label="Zoom out" title="Zoom out" className="flex size-8 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100" onClick={() => zoomBy(1 / 1.5)}>
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <span className="min-w-12 text-center font-mono text-[11px] tabular-nums text-gray-600">{formatZoom(view.userZoom)}%</span>
          <button type="button" aria-label="Zoom in" title="Zoom in" className="flex size-8 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100" onClick={() => zoomBy(1.5)}>
            <Plus className="size-4" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Fit to view" title="Fit to view" className="flex size-8 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100" onClick={zoomFit}>
            <Maximize2 className="size-4" aria-hidden="true" />
          </button>
        </div>
        {settingsOpen && activeSheet ? (
          <SheetSettings
            key={activeSheet.id}
            sessionId={sessionId}
            sheet={activeSheet}
            onClose={() => setSettingsOpen(false)}
            onDrawScale={() => {
              setSettingsOpen(false);
              onToolChange("scale");
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
PreconSheetViewer.displayName = "PreconSheetViewer";

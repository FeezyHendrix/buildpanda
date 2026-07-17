import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// ?worker makes Vite emit the worker as a .js chunk and hand back a Worker
// constructor — static hosts that serve .mjs as octet-stream (staging nginx)
// break both workerSrc and the fake-worker fallback, so never fetch .mjs.
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

let sharedWorker: Worker | null = null;
import { Spinner } from "@/components/atoms/spinner";
import { cn } from "@/lib/utils";
import { preconApi, type PreconBoqRow, type PreconGeometry, type PreconSheet } from "@/api/precon";
import {
  isVersionConflict,
  useAddPreconDeduction,
  usePreconSnapIndex,
  useUpdatePreconGeometry,
} from "@/hooks/use-precon";

export type PreconTool = "select" | "area" | "linear" | "count" | "deduct";

const TOOLS: { key: PreconTool; label: string; hint: string }[] = [
  { key: "select", label: "Select", hint: "Pan, zoom, pick measurements" },
  { key: "area", label: "Area m²", hint: "Redraw the selected item as a polygon" },
  { key: "linear", label: "Linear m", hint: "Redraw the selected item as a polyline" },
  { key: "count", label: "Count nr", hint: "Re-count the selected item with pins" },
  { key: "deduct", label: "Deduct", hint: "Draw an opening to subtract from the selected item" },
];

const SNAP_PX = 10;

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
}

interface PageInfo {
  widthPx: number;
  heightPx: number;
  heightPt: number;
  rasterScale: number;
}

const ELEMENT_STYLES = [
  { match: "wall finish", color: "#059669", label: "Wall finishes" },
  { match: "ceiling finish", color: "#10b981", label: "Ceiling finishes" },
  { match: "floor finish", color: "#16a34a", label: "Floor finishes" },
  { match: "wall", color: "#4f46e5", label: "Walls" },
  { match: "window", color: "#06b6d4", label: "Windows" },
  { match: "door", color: "#f59e0b", label: "Doors" },
  { match: "frame", color: "#9333ea", label: "Frame" },
  { match: "column", color: "#9333ea", label: "Frame" },
  { match: "beam", color: "#9333ea", label: "Frame" },
  { match: "roof", color: "#0d9488", label: "Roof" },
  { match: "substructure", color: "#78716c", label: "Substructure" },
  { match: "piling", color: "#78716c", label: "Substructure" },
  { match: "mechanical", color: "#ea580c", label: "Mechanical services" },
  { match: "electrical", color: "#dc2626", label: "Electrical services" },
  { match: "external", color: "#4b5563", label: "External works" },
  { match: "pavement", color: "#4b5563", label: "External works" },
];

const DEFAULT_ELEMENT_STYLE = { color: "#2563eb", label: "Other" };

function getElementStyle(elementGroup: string | null) {
  if (!elementGroup) return DEFAULT_ELEMENT_STYLE;
  const lower = elementGroup.toLowerCase();
  for (const style of ELEMENT_STYLES) {
    if (lower.includes(style.match)) return style;
  }
  return DEFAULT_ELEMENT_STYLE;
}

/** Page number within the sheet's own PDF file (sheets are contiguous per file). */
function pageWithinFile(sheet: PreconSheet, sheets: PreconSheet[]): number {
  const siblings = [...sheets.filter((s) => s.fileName === sheet.fileName)].sort((a, b) => a.pageNumber - b.pageNumber);
  return siblings.findIndex((s) => s.id === sheet.id) + 1;
}

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
}: ViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PageInfo | null>(null);
  const [rendering, setRendering] = useState(false);
  const [view, setView] = useState({ tx: 0, ty: 0, userZoom: 1 });
  const [draft, setDraft] = useState<number[][]>([]);
  const [note, setNote] = useState<string | null>(null);
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);

  const { data: snapPoints = [] } = usePreconSnapIndex(activeSheet?.id ?? null);
  const updateGeometry = useUpdatePreconGeometry(sessionId);
  const addDeduction = useAddPreconDeduction(sessionId);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const sheetGeometries = useMemo(
    () => geometries.filter((g) => g.sheetId === activeSheet?.id),
    [geometries, activeSheet?.id],
  );

  const presentStyles = useMemo(() => {
    const seen = new Set<string>();
    const styles: Array<{ color: string; label: string }> = [];
    for (const g of sheetGeometries) {
      const row = rowById.get(g.rowId);
      if (!row || row.status === "rejected") continue;
      const st = getElementStyle(row.elementGroup);
      if (!seen.has(st.label)) {
        seen.add(st.label);
        styles.push(st);
      }
    }
    return styles.sort((a, b) => a.label.localeCompare(b.label));
  }, [sheetGeometries, rowById]);

  const [activeRasterScale, setActiveRasterScale] = useState(1.5);
  const targetRasterScale = useMemo(() => {
    return Math.min(4.5, 1.5 * Math.max(1, Math.ceil(view.userZoom)));
  }, [view.userZoom]);

  useEffect(() => {
    if (targetRasterScale === activeRasterScale) return;
    const timer = setTimeout(() => {
      setActiveRasterScale(targetRasterScale);
    }, 200);
    return () => clearTimeout(timer);
  }, [targetRasterScale, activeRasterScale]);

  const lastSheetId = useRef<string | null>(null);

  // render the PDF page to canvas whenever the active sheet or raster scale changes
  useEffect(() => {
    if (!activeSheet) return;
    let cancelled = false;
    
    const isNewSheet = lastSheetId.current !== activeSheet.id;
    if (isNewSheet) {
      setDraft([]);
      setActiveRasterScale(1.5);
    }
    lastSheetId.current = activeSheet.id;
    
    const scaleToRender = isNewSheet ? 1.5 : activeRasterScale;

    setRendering(true);
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      if (!sharedWorker) sharedWorker = new PdfWorker();
      pdfjs.GlobalWorkerOptions.workerPort = sharedWorker;
      const doc = await pdfjs.getDocument({
        url: preconApi.sheetFileUrl(activeSheet.id),
        withCredentials: true,
      }).promise;
      if (cancelled) return;
      const pdfPage = await doc.getPage(pageWithinFile(activeSheet, sheets));
      const viewport = pdfPage.getViewport({ scale: scaleToRender });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
      if (cancelled) return;
      setPage({ 
        widthPx: viewport.width, 
        heightPx: viewport.height, 
        heightPt: viewport.height / scaleToRender,
        rasterScale: scaleToRender
      });
      if (isNewSheet) {
        setView({ tx: 0, ty: 0, userZoom: 1 });
      }
      setRendering(false);
    })().catch((error: unknown) => {
      if (!cancelled) {
        setRendering(false);
        const reason = error instanceof Error ? error.message : String(error);
        setNote(`Could not render this sheet: ${reason.slice(0, 160)}`);
      }
    });
    return () => {
      cancelled = true;
    };
    // sheets identity churn is fine; the file/page only depends on the sheet id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheet?.id, activeRasterScale]);

  const cssZoom = page ? (1.5 * view.userZoom) / page.rasterScale : view.userZoom;

  const toPx = useCallback(
    (pt: number[]): [number, number] => {
      // PDF points -> canvas pixels
      const rs = page?.rasterScale ?? 1.5;
      return [pt[0]! * rs, page!.heightPx - pt[1]! * rs];
    },
    [page],
  );

  const toPt = (pxX: number, pxY: number): [number, number] => {
    const rs = page?.rasterScale ?? 1.5;
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
    // snap to the nearest extracted CAD vertex within SNAP_PX (screen space)
    const thresholdPt = SNAP_PX / (1.5 * view.userZoom);
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
    // ortho lock relative to the previous draft vertex
    if (shift && draft.length > 0) {
      const prev = draft[draft.length - 1]!;
      if (Math.abs(x - prev[0]!) > Math.abs(y - prev[1]!)) y = prev[1]!;
      else x = prev[0]!;
    }
    return [x, y];
  };

  const selectedRow = selectedRowId ? rowById.get(selectedRowId) : null;
  const drawingEnabled = tool !== "select" && Boolean(selectedRow) && Boolean(activeSheet?.scaleMmPerPt);

  const commitDraft = () => {
    if (!selectedRow || draft.length === 0) {
      setDraft([]);
      return;
    }
    const onError = (error: unknown) =>
      setNote(
        isVersionConflict(error)
          ? "Row changed elsewhere — refreshed; redraw to apply."
          : error instanceof Error
            ? error.message
            : "Measurement failed",
      );
    if (tool === "deduct") {
      if (draft.length >= 3) {
        addDeduction.mutate(
          { rowId: selectedRow.id, version: selectedRow.version, label: "Opening (manual)", vertices: draft },
          { onError },
        );
      }
    } else if (tool === "area" && draft.length >= 3) {
      updateGeometry.mutate(
        { rowId: selectedRow.id, version: selectedRow.version, kind: "area", vertices: draft },
        { onError },
      );
    } else if (tool === "linear" && draft.length >= 2) {
      updateGeometry.mutate(
        { rowId: selectedRow.id, version: selectedRow.version, kind: "linear", vertices: draft },
        { onError },
      );
    } else if (tool === "count" && draft.length >= 1) {
      updateGeometry.mutate(
        { rowId: selectedRow.id, version: selectedRow.version, kind: "count", vertices: draft },
        { onError },
      );
    }
    setDraft([]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDraft([]);
      if (e.key === "Enter") commitDraft();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, tool, selectedRowId]);

  const onCanvasClick = (e: React.MouseEvent) => {
    if (!drawingEnabled) return;
    const canvasPt = screenToCanvas(e.clientX, e.clientY);
    if (!canvasPt) return;
    const pdfPt = toPt(canvasPt[0], canvasPt[1]);
    setDraft((prev) => [...prev, applySnapAndOrtho(pdfPt, e.shiftKey)]);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (tool !== "select") return;
    panRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const pan = panRef.current;
    if (!pan) return;
    setView((v) => ({ ...v, tx: pan.tx + e.clientX - pan.x, ty: pan.ty + e.clientY - pan.y }));
  };
  const endPan = () => {
    panRef.current = null;
  };

  const wheelDeltaRef = useRef(0);
  const wheelRafRef = useRef<number | null>(null);

  const onWheel = useCallback((e: React.WheelEvent) => {
    wheelDeltaRef.current += e.deltaY;
    
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    if (wheelRafRef.current === null) {
      wheelRafRef.current = requestAnimationFrame(() => {
        const delta = wheelDeltaRef.current;
        wheelDeltaRef.current = 0;
        wheelRafRef.current = null;
        if (delta === 0) return;

        const factor = Math.pow(1.15, -delta / 100);

        setView((v) => {
          const newZoom = Math.min(8, Math.max(0.2, v.userZoom * factor));
          if (newZoom === v.userZoom) return v;
          const zoomRatio = newZoom / v.userZoom;
          
          return {
            ...v,
            userZoom: newZoom,
            tx: cursorX - (cursorX - v.tx) * zoomRatio,
            ty: cursorY - (cursorY - v.ty) * zoomRatio,
          };
        });
      });
    }
  }, []);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 px-2 py-1.5">
        {sheets.map((sheet) => (
          <button
            key={sheet.id}
            type="button"
            onClick={() => onSelectSheet(sheet.id)}
            className={cn(
              "h-7 shrink-0 rounded-lg px-2.5 text-xs font-medium",
              sheet.id === activeSheet?.id ? "bg-primary-50 font-semibold text-primary-700" : "text-gray-600 hover:bg-gray-100",
              sheet.status === "unmeasurable" && "opacity-50",
            )}
            title={sheet.title ?? sheet.fileName}
          >
            {sheet.code ?? `p${sheet.pageNumber}`}
            {sheet.kind === "floor-plan" ? " · plan" : ""}
          </button>
        ))}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              title={t.hint}
              onClick={() => onToolChange(t.key)}
              className={cn(
                "h-7 rounded-lg px-2.5 text-xs font-medium",
                tool === t.key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeSheet?.scaleMmPerPt ? (
        <p className="border-b border-gray-100 px-3 py-1 text-[11px] text-gray-400">
          1:{Math.round(activeSheet.scaleMmPerPt / 0.3528)} · dims in {activeSheet.dimUnit} · calibration{" "}
          {Math.round((activeSheet.scaleConfidence ?? 0) * 100)}%
          {tool !== "select" && !selectedRow ? " — select a BOQ item to measure into" : ""}
          {drawingEnabled ? " — click to add points, Enter to finish, Esc to cancel, Shift for ortho" : ""}
        </p>
      ) : activeSheet ? (
        <p className="border-b border-amber-100 bg-amber-50 px-3 py-1 text-[11px] text-amber-700">
          {activeSheet.error ?? "No calibrated scale on this sheet — measurement disabled."}
        </p>
      ) : null}
      {note ? <p className="border-b border-amber-100 bg-amber-50 px-3 py-1 text-[11px] text-amber-700">{note}</p> : null}

      <div
        ref={containerRef}
        className={cn("relative min-h-0 flex-1 overflow-hidden bg-gray-100", tool === "select" ? "cursor-grab" : "cursor-crosshair")}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
        onWheel={onWheel}
        onClick={onCanvasClick}
        onDoubleClick={commitDraft}
      >
        {rendering ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : null}
        <div
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${cssZoom})`, transformOrigin: "0 0" }}
        >
          <canvas ref={canvasRef} className="block" />
          {page ? (
            <svg
              className="absolute left-0 top-0"
              width={page.widthPx}
              height={page.heightPx}
              viewBox={`0 0 ${page.widthPx} ${page.heightPx}`}
            >
              {sheetGeometries.map((g) => {
                const row = rowById.get(g.rowId);
                if (!row || row.status === "rejected") return null;
                const selected = g.rowId === selectedRowId;
                const estyle = getElementStyle(row.elementGroup);
                const stroke = estyle.color;
                const pts = g.vertices.map(toPx);
                const onPick = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onSelectRow(g.rowId);
                };

                let statusBadge = null;
                if (pts.length > 0 && (row.status === "verified" || row.status === "needs_review")) {
                  const [bx, by] = pts[0]!;
                  const badgeColor = row.status === "verified" ? "#059669" : "#d97706";
                  statusBadge = (
                    <circle cx={bx} cy={by} r={4} fill={badgeColor} stroke="#fff" strokeWidth={1.5} />
                  );
                }

                if (g.kind === "count") {
                  return (
                    <g key={g.id} onClick={onPick} className="cursor-pointer">
                      {pts.map(([x, y], i) => (
                        <circle
                          key={`${g.id}-${i}`}
                          cx={x}
                          cy={y}
                          r={selected ? 7 : 5}
                          fill={stroke}
                          fillOpacity={0.35}
                          stroke={selected ? "#004DE7" : stroke}
                          strokeWidth={selected ? 2.5 : 1.5}
                        />
                      ))}
                      {statusBadge}
                    </g>
                  );
                }
                const path = pts.map(([x, y]) => `${x},${y}`).join(" ");
                if (g.kind === "linear") {
                  return (
                    <g key={g.id} onClick={onPick} className="cursor-pointer">
                      {selected && (
                        <polyline
                          points={path}
                          fill="none"
                          stroke="#004DE7"
                          strokeWidth={6}
                          strokeOpacity={0.3}
                          strokeLinecap="round"
                        />
                      )}
                      <polyline
                        points={path}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={selected ? 3 : 2.5}
                        strokeLinecap="round"
                      />
                      {statusBadge}
                    </g>
                  );
                }
                return (
                  <g key={g.id} onClick={onPick} className="cursor-pointer">
                    {selected && (
                      <polygon
                        points={path}
                        fill="none"
                        stroke="#004DE7"
                        strokeWidth={4}
                        strokeOpacity={0.3}
                      />
                    )}
                    <polygon
                      points={path}
                      fill={stroke}
                      fillOpacity={g.kind === "deduction" ? 0.08 : 0.15}
                      stroke={stroke}
                      strokeWidth={selected ? 2.5 : 2}
                      strokeDasharray={g.kind === "deduction" ? "6 4" : undefined}
                    />
                    {statusBadge}
                  </g>
                );
              })}
              {draft.length > 0 ? (
                <polyline
                  points={draft.map((v) => toPx(v).join(",")).join(" ")}
                  fill="none"
                  stroke="#004DE7"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              ) : null}
              {draft.map((v, i) => {
                const [x, y] = toPx(v);
                return <circle key={i} cx={x} cy={y} r={4} fill="#004DE7" />;
              })}
            </svg>
          ) : null}
        </div>

        {presentStyles.length > 0 && (
          <div
            className="absolute bottom-3 left-3 flex flex-col rounded-lg border border-gray-200 bg-white/95 shadow-sm backdrop-blur transition-all"
            onMouseDown={(e) => e.stopPropagation()}
            onMouseMove={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLegendOpen(!legendOpen);
              }}
              className="flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase text-gray-500 hover:text-gray-700"
            >
              Legend
              <svg
                className={cn("ml-2 h-3 w-3 transition-transform", legendOpen ? "rotate-180" : "")}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {legendOpen && (
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto border-t border-gray-100 p-2">
                {presentStyles.map((st) => (
                  <div key={st.label} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: st.color }} />
                    <span className="text-[11px] text-gray-700">{st.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
PreconSheetViewer.displayName = "PreconSheetViewer";

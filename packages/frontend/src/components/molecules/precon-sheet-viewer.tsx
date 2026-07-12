import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const RENDER_SCALE = 1.5;
const SNAP_PX = 10;

interface ViewerProps {
  projectId: string;
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
}

function statusStroke(status: PreconBoqRow["status"], selected: boolean): string {
  if (selected) return "#004DE7";
  if (status === "verified") return "#059669";
  if (status === "needs_review") return "#d97706";
  if (status === "rejected") return "#dc2626";
  return "#2563eb";
}

/** Page number within the sheet's own PDF file (sheets are contiguous per file). */
function pageWithinFile(sheet: PreconSheet, sheets: PreconSheet[]): number {
  const siblings = [...sheets.filter((s) => s.fileName === sheet.fileName)].sort((a, b) => a.pageNumber - b.pageNumber);
  return siblings.findIndex((s) => s.id === sheet.id) + 1;
}

export function PreconSheetViewer({
  projectId,
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
  const [view, setView] = useState({ tx: 0, ty: 0, zoom: 1 });
  const [draft, setDraft] = useState<number[][]>([]);
  const [note, setNote] = useState<string | null>(null);
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const { data: snapPoints = [] } = usePreconSnapIndex(projectId, activeSheet?.id ?? null);
  const updateGeometry = useUpdatePreconGeometry(projectId, sessionId);
  const addDeduction = useAddPreconDeduction(projectId, sessionId);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const sheetGeometries = useMemo(
    () => geometries.filter((g) => g.sheetId === activeSheet?.id),
    [geometries, activeSheet?.id],
  );

  // render the PDF page to canvas whenever the active sheet changes
  useEffect(() => {
    if (!activeSheet) return;
    let cancelled = false;
    setRendering(true);
    setDraft([]);
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const doc = await pdfjs.getDocument({
        url: preconApi.sheetFileUrl(projectId, activeSheet.id),
        withCredentials: true,
      }).promise;
      if (cancelled) return;
      const pdfPage = await doc.getPage(pageWithinFile(activeSheet, sheets));
      const viewport = pdfPage.getViewport({ scale: RENDER_SCALE });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
      if (cancelled) return;
      setPage({ widthPx: viewport.width, heightPx: viewport.height, heightPt: viewport.height / RENDER_SCALE });
      setView({ tx: 0, ty: 0, zoom: 1 });
      setRendering(false);
    })().catch(() => {
      if (!cancelled) {
        setRendering(false);
        setNote("Could not render this sheet");
      }
    });
    return () => {
      cancelled = true;
    };
    // sheets identity churn is fine; the file/page only depends on the sheet id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, activeSheet?.id]);

  const toPx = useCallback(
    (pt: number[]): [number, number] => [pt[0]! * RENDER_SCALE, (page ? page.heightPt - pt[1]! : 0) * RENDER_SCALE],
    [page],
  );

  const toPt = useCallback(
    (px: number, py: number): [number, number] => [px / RENDER_SCALE, (page?.heightPt ?? 0) - py / RENDER_SCALE],
    [page],
  );

  const screenToCanvas = (clientX: number, clientY: number): [number, number] | null => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return [(clientX - rect.left - view.tx) / view.zoom, (clientY - rect.top - view.ty) / view.zoom];
  };

  const applySnapAndOrtho = (pt: [number, number], shift: boolean): [number, number] => {
    let [x, y] = pt;
    // snap to the nearest extracted CAD vertex within SNAP_PX (screen space)
    const thresholdPt = SNAP_PX / (RENDER_SCALE * view.zoom);
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

  const onWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setView((v) => ({ ...v, zoom: Math.min(8, Math.max(0.2, v.zoom * factor)) }));
  };

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 px-2 py-1.5">
        {sheets.map((sheet) => (
          <button
            key={sheet.id}
            type="button"
            onClick={() => onSelectSheet(sheet.id)}
            className={cn(
              "shrink-0 rounded px-2 py-1 text-xs",
              sheet.id === activeSheet?.id ? "bg-primary-50 font-semibold text-primary-700" : "text-gray-600 hover:bg-gray-50",
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
                "rounded px-2 py-1 text-xs",
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
          style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.zoom})`, transformOrigin: "0 0" }}
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
                const stroke = statusStroke(row?.status ?? null, selected);
                const pts = g.vertices.map(toPx);
                const onPick = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onSelectRow(g.rowId);
                };
                if (g.kind === "count") {
                  return pts.map(([x, y], i) => (
                    <circle
                      key={`${g.id}-${i}`}
                      cx={x}
                      cy={y}
                      r={selected ? 7 : 5}
                      fill={stroke}
                      fillOpacity={0.35}
                      stroke={stroke}
                      strokeWidth={1.5}
                      onClick={onPick}
                      className="cursor-pointer"
                    />
                  ));
                }
                const path = pts.map(([x, y]) => `${x},${y}`).join(" ");
                if (g.kind === "linear") {
                  return (
                    <polyline
                      key={g.id}
                      points={path}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={selected ? 4 : 2.5}
                      strokeLinecap="round"
                      onClick={onPick}
                      className="cursor-pointer"
                    />
                  );
                }
                return (
                  <polygon
                    key={g.id}
                    points={path}
                    fill={stroke}
                    fillOpacity={g.kind === "deduction" ? 0.08 : 0.15}
                    stroke={stroke}
                    strokeWidth={selected ? 3 : 2}
                    strokeDasharray={g.kind === "deduction" ? "6 4" : undefined}
                    onClick={onPick}
                    className="cursor-pointer"
                  />
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
      </div>
    </div>
  );
}
PreconSheetViewer.displayName = "PreconSheetViewer";

import { useMemo, useRef, useState } from "react";
import { MARKUP_KIND, type DrawingMarkup } from "@/api/drawing-markup";
import { useCreatePreconMarkup, usePreconMarkups } from "@/hooks/use-precon-markups";
import { newOperationId, useEditorOperation } from "@/hooks/use-precon-editor";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import type { PenStyle } from "./pen-presets";

// Freehand ink on a sheet. A pen stroke says something about the drawing and
// is never a quantity, so it is stored as a markup in sheet points beside the
// pins, not as geometry against a bill line.

const MIN_STEP_PX = 2;
const MAX_POINTS = 1000;

export interface InkLayerProps {
  sessionId: string;
  sheetId: string;
  widthPx: number;
  heightPx: number;
  toPx: (pt: number[]) => [number, number];
  toPt: (pxX: number, pxY: number) => [number, number];
  cssZoom: number;
  /** True while the Pen tool is active. The pen STAYS active between strokes. */
  drawing: boolean;
  /** True while the Select tool is active: strokes become pickable for move/delete. */
  selectable: boolean;
  style: PenStyle;
  onDrawn?: () => void;
}

function pathFrom(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
}

/**
 * Every saved pen stroke on this sheet, plus the one being drawn. Corrections
 * (move, delete) go through the operation envelope with the stroke's version,
 * so every one is a receipt and undoable; a `pointercancel` mid-stroke
 * discards the interrupted ink rather than saving half a thought.
 */
export function InkLayer({ sessionId, sheetId, widthPx, heightPx, toPx, toPt, cssZoom, drawing, selectable, style, onDrawn }: InkLayerProps) {
  const { data: markups } = usePreconMarkups(sessionId);
  const create = useCreatePreconMarkup(sessionId);
  const operation = useEditorOperation(sessionId);
  const [stroke, setStroke] = useState<[number, number][] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const last = useRef<[number, number] | null>(null);
  const dragRef = useRef<{ markup: DrawingMarkup; startPx: [number, number]; deltaPx: [number, number] } | null>(null);
  const [dragDeltaPx, setDragDeltaPx] = useState<[number, number] | null>(null);

  const saved = useMemo(
    () =>
      (markups ?? []).filter(
        (m): m is DrawingMarkup => m.kind === MARKUP_KIND.PEN && m.preconSheetId === sheetId && m.geometry.kind === "pen",
      ),
    [markups, sheetId],
  );
  const selected = saved.find((m) => m.id === selectedId) ?? null;

  const pointAt = (e: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const box = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - box.left) / cssZoom, (e.clientY - box.top) / cssZoom];
  };

  const begin = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing || e.button !== 0) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // no capture: the stroke still follows pointermove while the button is down
    }
    const at = pointAt(e);
    last.current = at;
    setStroke([at]);
  };

  const extend = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!stroke) return;
    e.stopPropagation();
    const at = pointAt(e);
    const from = last.current;
    if (from && Math.hypot(at[0] - from[0], at[1] - from[1]) < MIN_STEP_PX) return;
    last.current = at;
    setStroke((current) => (current && current.length < MAX_POINTS ? [...current, at] : current));
  };

  const finish = async (e: React.PointerEvent<SVGSVGElement>) => {
    if (!stroke) return;
    e.stopPropagation();
    const drawn = stroke;
    setStroke(null);
    last.current = null;
    if (drawn.length < 2) return;
    try {
      // the create route accepts `style` now — one gesture, one receipt
      await create.mutateAsync({
        sheetId,
        kind: MARKUP_KIND.PEN,
        color: style.color,
        style: { color: style.color, strokeWidthPx: style.strokeWidthPx },
        geometry: {
          kind: "pen",
          space: "points",
          points: drawn.map(([x, y]) => {
            const [px, py] = toPt(x, y);
            return { x: px, y: py };
          }),
        },
      });
      onDrawn?.();
    } catch (err) {
      toast(getApiErrorMessage(err, "Could not save that stroke."), "error");
    }
  };

  /** An interrupted pointer discards the half-drawn ink; nothing is saved. */
  const cancelStroke = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!stroke) return;
    e.stopPropagation();
    setStroke(null);
    last.current = null;
  };

  const startStrokeDrag = (markup: DrawingMarkup) => (e: React.PointerEvent<SVGPathElement>) => {
    if (!selectable || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(markup.id);
    dragRef.current = { markup, startPx: [e.clientX, e.clientY], deltaPx: [0, 0] };
    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      drag.deltaPx = [(ev.clientX - drag.startPx[0]) / cssZoom, (ev.clientY - drag.startPx[1]) / cssZoom];
      setDragDeltaPx([...drag.deltaPx]);
    };
    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDragDeltaPx(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!drag || Math.hypot(drag.deltaPx[0], drag.deltaPx[1]) < 3) return;
      if (drag.markup.geometry.kind !== "pen") return;
      const moved = drag.markup.geometry.points.map((p) => {
        const [cx, cy] = toPx([p.x, p.y]);
        const [nx, ny] = toPt(cx + drag.deltaPx[0], cy + drag.deltaPx[1]);
        return { x: nx, y: ny };
      });
      operation.mutate(
        {
          operationId: newOperationId(),
          command: { kind: "edit-markup", markupId: drag.markup.id, version: drag.markup.version ?? 1, geometry: { ...drag.markup.geometry, points: moved } },
        },
        { onError: (err) => toast(getApiErrorMessage(err, "Could not move the stroke."), "error") },
      );
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const deleteSelected = () => {
    if (!selected) return;
    operation.mutate(
      { operationId: newOperationId(), command: { kind: "delete-markup", markupId: selected.id, version: selected.version ?? 1 } },
      {
        onSuccess: () => setSelectedId(null),
        onError: (err) => toast(getApiErrorMessage(err, "Could not delete the stroke."), "error"),
      },
    );
  };

  return (
    <svg
      className="absolute left-0 top-0"
      width={widthPx}
      height={heightPx}
      style={{ pointerEvents: drawing ? "auto" : "none", cursor: drawing ? "crosshair" : undefined, overflow: "visible" }}
      onPointerDown={begin}
      onPointerMove={extend}
      onPointerUp={finish}
      onPointerCancel={cancelStroke}
      aria-hidden="true"
    >
      {saved.map((markup) => {
        const geometry = markup.geometry;
        if (geometry.kind !== "pen") return null;
        const isSelected = markup.id === selectedId;
        const delta = isSelected && dragDeltaPx ? dragDeltaPx : [0, 0];
        const points = geometry.points.map((p) => {
          const [x, y] = toPx([p.x, p.y]);
          return [x + delta[0]!, y + delta[1]!] as [number, number];
        });
        const width = (markup.style?.strokeWidthPx ?? 2) / cssZoom;
        return (
          <g key={markup.id} data-ink-stroke={markup.id} data-ink-selected={isSelected || undefined}>
            {isSelected ? (
              <path d={pathFrom(points)} fill="none" stroke="#111827" strokeWidth={width + 5 / cssZoom} strokeOpacity={0.25} strokeLinecap="round" style={{ pointerEvents: "none" }} />
            ) : null}
            <path
              d={pathFrom(points)}
              fill="none"
              stroke={markup.style?.color ?? markup.color ?? "#DC2626"}
              strokeWidth={width}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={markup.resolvedAt ? 0.35 : 1}
              style={selectable ? { pointerEvents: "stroke", cursor: "move" } : undefined}
              onPointerDown={startStrokeDrag(markup)}
              onClick={(e) => {
                if (!selectable) return;
                e.stopPropagation();
                setSelectedId(markup.id);
              }}
            />
            {isSelected && points[0] ? (
              <foreignObject x={points[0][0] + 8 / cssZoom} y={points[0][1] - 14 / cssZoom} width={130 / cssZoom} height={30 / cssZoom} style={{ pointerEvents: "auto", overflow: "visible" }}>
                <button
                  type="button"
                  data-ink-delete
                  style={{ transform: `scale(${1 / cssZoom})`, transformOrigin: "top left" }}
                  className="rounded-md border border-line bg-white px-2 py-0.5 text-xs text-red-600 shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSelected();
                  }}
                >
                  Delete stroke
                </button>
              </foreignObject>
            ) : null}
          </g>
        );
      })}
      {stroke && stroke.length > 1 ? (
        <path
          d={pathFrom(stroke)}
          fill="none"
          stroke={style.color}
          strokeWidth={style.strokeWidthPx / cssZoom}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${4 / cssZoom} ${3 / cssZoom}`}
        />
      ) : null}
    </svg>
  );
}

InkLayer.displayName = "InkLayer";

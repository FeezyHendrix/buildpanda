import { useMemo, useRef, useState } from "react";
import { MARKUP_KIND, type DrawingMarkup } from "@/api/drawing-markup";
import { useCreatePreconMarkup, usePreconMarkups } from "@/hooks/use-precon-markups";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";

// Freehand ink on a sheet. A pen stroke says something about the drawing and
// is never a quantity, so it is stored as a markup in sheet points beside the
// pins, not as geometry against a bill line.

const INK_COLOR = "#DC2626";
const STROKE_PX = 2;
// a stroke is sampled on move; points closer than this add nothing but weight
const MIN_STEP_PX = 2;
const MAX_POINTS = 1000;

export interface InkLayerProps {
  sessionId: string;
  sheetId: string;
  widthPx: number;
  heightPx: number;
  /** Sheet points → canvas pixels, and back; strokes are stored in sheet points. */
  toPx: (pt: number[]) => [number, number];
  toPt: (pxX: number, pxY: number) => [number, number];
  /** The transform wrapper's scale, so ink keeps a constant on-screen weight. */
  cssZoom: number;
  /** True while the Pen tool is active. */
  drawing: boolean;
  /** Called when a stroke is saved, so the palette can return to Select. */
  onDrawn?: () => void;
}

function pathFrom(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
}

/** Every saved pen stroke on this sheet, plus the one being drawn. */
export function InkLayer({ sessionId, sheetId, widthPx, heightPx, toPx, toPt, cssZoom, drawing, onDrawn }: InkLayerProps) {
  const { data: markups } = usePreconMarkups(sessionId);
  const create = useCreatePreconMarkup(sessionId);
  const [stroke, setStroke] = useState<[number, number][] | null>(null);
  const last = useRef<[number, number] | null>(null);

  const saved = useMemo(
    () =>
      (markups ?? []).filter(
        (m): m is DrawingMarkup => m.kind === MARKUP_KIND.PEN && m.preconSheetId === sheetId && m.geometry.kind === "pen",
      ),
    [markups, sheetId],
  );

  const pointAt = (e: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const box = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - box.left) / cssZoom, (e.clientY - box.top) / cssZoom];
  };

  const begin = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing || e.button !== 0) return;
    e.stopPropagation();
    // capture keeps the stroke alive if the pointer leaves the sheet; a pointer
    // the browser no longer tracks cannot be captured, and that must not stop
    // the stroke
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
    // two points is the least that reads as a line; a tap is a slip, not ink
    if (drawn.length < 2) return;
    try {
      await create.mutateAsync({
        sheetId,
        kind: MARKUP_KIND.PEN,
        color: INK_COLOR,
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

  return (
    <svg
      className="absolute left-0 top-0"
      width={widthPx}
      height={heightPx}
      style={{ pointerEvents: drawing ? "auto" : "none", cursor: drawing ? "crosshair" : undefined }}
      onPointerDown={begin}
      onPointerMove={extend}
      onPointerUp={finish}
      onPointerCancel={finish}
      aria-hidden="true"
    >
      {saved.map((markup) => {
        const geometry = markup.geometry;
        if (geometry.kind !== "pen") return null;
        const points = geometry.points.map((p) => toPx([p.x, p.y]));
        return (
          <path
            key={markup.id}
            d={pathFrom(points)}
            fill="none"
            stroke={markup.color || INK_COLOR}
            strokeWidth={STROKE_PX / cssZoom}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={markup.resolvedAt ? 0.35 : 1}
          />
        );
      })}
      {stroke && stroke.length > 1 ? (
        <path
          d={pathFrom(stroke)}
          fill="none"
          stroke={INK_COLOR}
          strokeWidth={STROKE_PX / cssZoom}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${4 / cssZoom} ${3 / cssZoom}`}
        />
      ) : null}
    </svg>
  );
}

InkLayer.displayName = "InkLayer";

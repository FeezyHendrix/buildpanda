import { palette } from "@/constants/colors";
import { cloudPath, measureLabel, measureTicks } from "./markup-shapes";
import { MARKUP_KIND, type MarkupPoint, type MarkupRect, type SheetMarkup } from "./markup-types";

// In sheet pixels (the layer is inside the zoomed content, so these scale with it)
const CLOUD_BUMP_PX = 9;
const TICK_HALF_PX = 7;
const LABEL_FONT_PX = 13;

function toPx(p: MarkupPoint, w: number, h: number): { x: number; y: number } {
  return { x: (p.x / 100) * w, y: (p.y / 100) * h };
}

function rectPx(r: MarkupRect, w: number, h: number): MarkupRect {
  return { x: (r.x / 100) * w, y: (r.y / 100) * h, w: (r.w / 100) * w, h: (r.h / 100) * h };
}

function distToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Nearest markup within `threshold` px of a tap, in displayed-sheet pixel space. */
export function hitTestMarkup(
  markups: SheetMarkup[],
  pt: { x: number; y: number },
  w: number,
  h: number,
  threshold: number,
): string | null {
  let best: { id: string; dist: number } | null = null;
  for (const m of markups) {
    let dist = Number.POSITIVE_INFINITY;
    const g = m.geometry;
    if (g.kind === MARKUP_KIND.PIN) {
      dist = Math.hypot(pt.x - toPx(g.at, w, h).x, pt.y - toPx(g.at, w, h).y);
    } else if (g.kind === MARKUP_KIND.PEN) {
      for (let i = 1; i < g.points.length; i++) {
        dist = Math.min(dist, distToSegment(pt, toPx(g.points[i - 1], w, h), toPx(g.points[i], w, h)));
      }
      if (g.points.length === 1) dist = Math.hypot(pt.x - toPx(g.points[0], w, h).x, pt.y - toPx(g.points[0], w, h).y);
    } else if (g.kind === MARKUP_KIND.CLOUD) {
      const r = rectPx(g.rect, w, h);
      const inside = pt.x >= r.x - threshold && pt.x <= r.x + r.w + threshold && pt.y >= r.y - threshold && pt.y <= r.y + r.h + threshold;
      if (inside) dist = 0;
    } else {
      dist = distToSegment(pt, toPx(g.a, w, h), toPx(g.b, w, h));
    }
    if (dist <= threshold && (!best || dist < best.dist)) best = { id: m.id, dist };
  }
  return best?.id ?? null;
}

function PinShape({ at, color, selected, resolved, w, h }: { at: MarkupPoint; color: string; selected: boolean; resolved: boolean; w: number; h: number }) {
  const p = toPx(at, w, h);
  return (
    <g opacity={resolved ? 0.45 : 1}>
      {selected ? <circle cx={p.x} cy={p.y} r={19} fill="none" stroke={color} strokeWidth={2} /> : null}
      <circle cx={p.x} cy={p.y} r={13} fill={color} stroke={palette.surface} strokeWidth={2.5} />
      <circle cx={p.x} cy={p.y} r={4} fill={palette.surface} />
    </g>
  );
}

function PenShape({ pts, color, selected, resolved, w, h }: { pts: MarkupPoint[]; color: string; selected: boolean; resolved: boolean; w: number; h: number }) {
  return (
    <polyline
      points={pts.map((p) => `${(p.x / 100) * w},${(p.y / 100) * h}`).join(" ")}
      fill="none"
      stroke={color}
      strokeWidth={selected ? 5 : 3}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={resolved ? 0.45 : 1}
    />
  );
}

function CloudShape({ rect, color, selected, resolved, w, h }: { rect: MarkupRect; color: string; selected: boolean; resolved: boolean; w: number; h: number }) {
  const r = rectPx(rect, w, h);
  return (
    <g opacity={resolved ? 0.45 : 1}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={color} fillOpacity={0.06} stroke="none" />
      <path d={cloudPath(r, CLOUD_BUMP_PX)} fill="none" stroke={color} strokeWidth={selected ? 4.5 : 3} strokeLinecap="round" />
    </g>
  );
}

/** A dimension line: end ticks and a length label, or "no scale set" until the sheet is calibrated. */
function MeasureShape({
  a,
  b,
  color,
  selected,
  resolved,
  w,
  h,
  aspect,
  metresPerPct,
}: {
  a: MarkupPoint;
  b: MarkupPoint;
  color: string;
  selected: boolean;
  resolved: boolean;
  w: number;
  h: number;
  aspect: number;
  metresPerPct: number | null;
}) {
  const pa = toPx(a, w, h);
  const pb = toPx(b, w, h);
  const [ta, tb] = measureTicks(pa, pb, TICK_HALF_PX);
  const midX = (pa.x + pb.x) / 2;
  const midY = (pa.y + pb.y) / 2;
  return (
    <g opacity={resolved ? 0.45 : 1}>
      <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={color} strokeWidth={selected ? 4 : 2.5} />
      <line x1={ta.x1} y1={ta.y1} x2={ta.x2} y2={ta.y2} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <line x1={tb.x1} y1={tb.y1} x2={tb.x2} y2={tb.y2} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <text
        x={midX}
        y={midY - 8}
        textAnchor="middle"
        fill={color}
        fontSize={LABEL_FONT_PX}
        fontWeight={700}
        fontFamily="system-ui, sans-serif"
        paintOrder="stroke"
        stroke={palette.surface}
        strokeWidth={3.5}
        strokeLinejoin="round"
      >
        {measureLabel(a, b, aspect, metresPerPct)}
      </text>
    </g>
  );
}

export interface DraftShapes {
  pen: MarkupPoint[] | null;
  rect: MarkupRect | null;
  measure: { a: MarkupPoint; b: MarkupPoint } | null;
  /** The first point of a two-tap measure, waiting for its second. */
  measureStart: MarkupPoint | null;
  pin: MarkupPoint | null;
}

export function MarkupLayer({
  markups,
  draft,
  draftColor,
  width,
  height,
  selectedId,
  aspect,
  metresPerPct,
}: {
  markups: SheetMarkup[];
  draft: DraftShapes;
  draftColor: string;
  width: number;
  height: number;
  selectedId: string | null;
  aspect: number;
  metresPerPct: number | null;
}) {
  if (width <= 0 || height <= 0) return null;
  const size = { w: width, h: height };
  return (
    <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
      {markups.map((m) => {
        const common = { color: m.color, selected: m.id === selectedId, resolved: m.resolved, ...size };
        const g = m.geometry;
        if (g.kind === MARKUP_KIND.PIN) return <PinShape key={m.id} at={g.at} {...common} />;
        if (g.kind === MARKUP_KIND.PEN) return <PenShape key={m.id} pts={g.points} {...common} />;
        if (g.kind === MARKUP_KIND.CLOUD) return <CloudShape key={m.id} rect={g.rect} {...common} />;
        return <MeasureShape key={m.id} a={g.a} b={g.b} aspect={aspect} metresPerPct={metresPerPct} {...common} />;
      })}

      {draft.pin ? <PinShape at={draft.pin} color={draftColor} selected resolved={false} {...size} /> : null}
      {draft.pen && draft.pen.length > 1 ? <PenShape pts={draft.pen} color={draftColor} selected={false} resolved={false} {...size} /> : null}
      {draft.rect ? <CloudShape rect={draft.rect} color={draftColor} selected={false} resolved={false} {...size} /> : null}
      {draft.measure ? (
        <MeasureShape a={draft.measure.a} b={draft.measure.b} color={draftColor} selected={false} resolved={false} aspect={aspect} metresPerPct={metresPerPct} {...size} />
      ) : draft.measureStart ? (
        <circle cx={toPx(draft.measureStart, width, height).x} cy={toPx(draft.measureStart, width, height).y} r={5} fill={draftColor} stroke={palette.surface} strokeWidth={2} />
      ) : null}
    </svg>
  );
}

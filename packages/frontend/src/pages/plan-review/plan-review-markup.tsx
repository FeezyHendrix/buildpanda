import { cn } from "@/lib/utils";
import { measureLabel, type Pt } from "./plan-review-data";
import { MARKUP_KIND } from "@/api/drawing-markup";

export interface PenMarkup {
  id: string;
  sheetId: string;
  tool: "pen";
  color: string;
  points: Pt[];
}

export interface CloudMarkup {
  id: string;
  sheetId: string;
  tool: "cloud";
  color: string;
  rect: { x: number; y: number; w: number; h: number };
}

export interface MeasureMarkup {
  id: string;
  sheetId: string;
  tool: "measure";
  color: string;
  a: Pt;
  b: Pt;
}

export type Markup = PenMarkup | CloudMarkup | MeasureMarkup;

// ── Geometry ───────────────────────────────────────────────────────────────

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

const HIT_TOLERANCE = 2.2;

export function hitTestMarkup(markups: Markup[], point: Pt): Markup | null {
  for (let i = markups.length - 1; i >= 0; i--) {
    const markup = markups[i];
    if (!markup) continue;
    if (markup.tool === MARKUP_KIND.MEASURE) {
      if (distToSegment(point, markup.a, markup.b) <= HIT_TOLERANCE) return markup;
    } else if (markup.tool === MARKUP_KIND.CLOUD) {
      const { x, y, w, h } = markup.rect;
      const near =
        point.x >= x - HIT_TOLERANCE &&
        point.x <= x + w + HIT_TOLERANCE &&
        point.y >= y - HIT_TOLERANCE &&
        point.y <= y + h + HIT_TOLERANCE;
      const insideCore =
        point.x > x + HIT_TOLERANCE &&
        point.x < x + w - HIT_TOLERANCE &&
        point.y > y + HIT_TOLERANCE &&
        point.y < y + h - HIT_TOLERANCE;
      if (near && !insideCore) return markup;
    } else {
      for (let j = 0; j < markup.points.length - 1; j++) {
        const a = markup.points[j];
        const b = markup.points[j + 1];
        if (a && b && distToSegment(point, a, b) <= HIT_TOLERANCE) return markup;
      }
    }
  }
  return null;
}

// Revision-cloud outline: a rectangle whose edges are drawn as a run of small
// outward arcs (the standard "cloud" annotation on construction drawings).
export function cloudPath(rect: { x: number; y: number; w: number; h: number }, bump = 2.2): string {
  const { x, y, w, h } = rect;
  const step = bump * 1.7;
  const segments: string[] = [`M ${x} ${y}`];
  const arc = (tx: number, ty: number) => segments.push(`A ${bump} ${bump} 0 0 1 ${tx} ${ty}`);
  for (let cx = x; cx < x + w - 0.01; ) {
    const next = Math.min(cx + step, x + w);
    arc(next, y);
    cx = next;
  }
  for (let cy = y; cy < y + h - 0.01; ) {
    const next = Math.min(cy + step, y + h);
    arc(x + w, next);
    cy = next;
  }
  for (let cx = x + w; cx > x + 0.01; ) {
    const next = Math.max(cx - step, x);
    arc(next, y + h);
    cx = next;
  }
  for (let cy = y + h; cy > y + 0.01; ) {
    const next = Math.max(cy - step, y);
    arc(x, next);
    cy = next;
  }
  return segments.join(" ");
}

export function normalizedRect(a: Pt, b: Pt): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

// ── Rendering ──────────────────────────────────────────────────────────────

function MeasureShape({
  markup,
  scale,
  aspect,
  selected,
  customFtPerPct,
}: {
  markup: MeasureMarkup;
  scale: string | null;
  aspect: number;
  selected: boolean;
  customFtPerPct?: number;
}) {
  const { a, b, color } = markup;
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  return (
    <g>
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={color}
        strokeWidth={selected ? 3 : 2}
        vectorEffect="non-scaling-stroke"
      />
      {[a, b].map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={0.6} fill={color} />
      ))}
      <text
        x={midX}
        y={midY - 1.4}
        textAnchor="middle"
        fill={color}
        fontSize={2.6}
        fontWeight={700}
        paintOrder="stroke"
        stroke="#ffffff"
        strokeWidth={0.7}
      >
        {measureLabel(a, b, scale, aspect, customFtPerPct)}
      </text>
    </g>
  );
}

export function MarkupLayer({
  markups,
  draft,
  selectedId,
  scale,
  aspect,
  customFtPerPct,
  className,
}: {
  markups: Markup[];
  draft: Markup | null;
  selectedId: string | null;
  scale: string | null;
  aspect: number;
  customFtPerPct?: number;
  className?: string;
}) {
  const all = draft ? [...markups, draft] : markups;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute inset-0 h-full w-full overflow-visible", className)}
    >
      {all.map((markup) => {
        const selected = markup.id === selectedId;
        if (markup.tool === MARKUP_KIND.MEASURE) {
          return <MeasureShape key={markup.id} markup={markup} scale={scale} aspect={aspect} selected={selected} customFtPerPct={customFtPerPct} />;
        }
        if (markup.tool === MARKUP_KIND.CLOUD) {
          return (
            <path
              key={markup.id}
              d={cloudPath(markup.rect)}
              fill="none"
              stroke={markup.color}
              strokeWidth={selected ? 3 : 2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        return (
          <polyline
            key={markup.id}
            points={markup.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={markup.color}
            strokeWidth={selected ? 3.5 : 2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

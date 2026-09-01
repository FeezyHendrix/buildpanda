import { MARKUP_KIND, type MarkupPoint, type SheetMarkup } from "./markup-types";

function toPx(p: MarkupPoint, w: number, h: number): { x: number; y: number } {
  return { x: (p.x / 100) * w, y: (p.y / 100) * h };
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
      const x = (g.rect.x / 100) * w;
      const y = (g.rect.y / 100) * h;
      const rw = (g.rect.w / 100) * w;
      const rh = (g.rect.h / 100) * h;
      const inside = pt.x >= x - threshold && pt.x <= x + rw + threshold && pt.y >= y - threshold && pt.y <= y + rh + threshold;
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
      <circle cx={p.x} cy={p.y} r={13} fill={color} stroke="#FFFFFF" strokeWidth={2.5} />
      <circle cx={p.x} cy={p.y} r={4} fill="#FFFFFF" />
    </g>
  );
}

function points(list: MarkupPoint[], w: number, h: number): string {
  return list.map((p) => `${(p.x / 100) * w},${(p.y / 100) * h}`).join(" ");
}

export function MarkupLayer({
  markups,
  draftPen,
  draftRect,
  draftPin,
  width,
  height,
  selectedId,
}: {
  markups: SheetMarkup[];
  draftPen: MarkupPoint[] | null;
  draftRect: { x: number; y: number; w: number; h: number } | null;
  draftPin: MarkupPoint | null;
  width: number;
  height: number;
  selectedId: string | null;
}) {
  if (width <= 0 || height <= 0) return null;
  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
    >
      {markups.map((m) => {
        const selected = m.id === selectedId;
        const g = m.geometry;
        if (g.kind === MARKUP_KIND.PIN) {
          return <PinShape key={m.id} at={g.at} color={m.color} selected={selected} resolved={m.resolved} w={width} h={height} />;
        }
        if (g.kind === MARKUP_KIND.PEN) {
          return (
            <polyline
              key={m.id}
              points={points(g.points, width, height)}
              fill="none"
              stroke={m.color}
              strokeWidth={selected ? 5 : 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={m.resolved ? 0.45 : 1}
            />
          );
        }
        if (g.kind === MARKUP_KIND.CLOUD) {
          return (
            <rect
              key={m.id}
              x={(g.rect.x / 100) * width}
              y={(g.rect.y / 100) * height}
              width={(g.rect.w / 100) * width}
              height={(g.rect.h / 100) * height}
              rx={6}
              fill={m.color}
              fillOpacity={0.08}
              stroke={m.color}
              strokeWidth={selected ? 4.5 : 3}
              strokeDasharray="10 6"
              opacity={m.resolved ? 0.45 : 1}
            />
          );
        }
        const a = toPx(g.a, width, height);
        const b = toPx(g.b, width, height);
        return (
          <g key={m.id} opacity={m.resolved ? 0.45 : 1}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={m.color} strokeWidth={selected ? 4 : 2.5} />
            <circle cx={a.x} cy={a.y} r={4} fill={m.color} />
            <circle cx={b.x} cy={b.y} r={4} fill={m.color} />
          </g>
        );
      })}

      {draftPin ? (
        <PinShape at={draftPin} color="#004DE7" selected resolved={false} w={width} h={height} />
      ) : null}
      {draftPen && draftPen.length > 1 ? (
        <polyline
          points={points(draftPen, width, height)}
          fill="none"
          stroke="#004DE7"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {draftRect ? (
        <rect
          x={(draftRect.x / 100) * width}
          y={(draftRect.y / 100) * height}
          width={(draftRect.w / 100) * width}
          height={(draftRect.h / 100) * height}
          rx={6}
          fill="#004DE7"
          fillOpacity={0.06}
          stroke="#004DE7"
          strokeWidth={3}
          strokeDasharray="10 6"
        />
      ) : null}
    </svg>
  );
}

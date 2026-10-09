// Pure edits on the LOGICAL measurement shape (contract §7): corners are
// [start, seg0.end, …]; an arc's `mid` is a point ON the arc. The server
// remains authoritative for quantities — this module only reshapes geometry
// and offers the analytic length the same mathematics the server uses.
import type { MeasurementShape, PathSegment } from "@/api/precon-row-types";

export type PathShape = Extract<MeasurementShape, { role: "path" }>;

export const isPathShape = (shape: MeasurementShape | null | undefined): shape is PathShape =>
  shape?.role === "path";

export const hasArc = (shape: MeasurementShape | null | undefined): boolean =>
  isPathShape(shape) && shape.segments.some((seg) => seg.kind === "arc");

/** One point per corner: the start, then every segment's end. */
export function cornersOf(shape: PathShape): [number, number][] {
  return [shape.start, ...shape.segments.map((seg) => seg.end)];
}

export function moveCorner(shape: PathShape, cornerIndex: number, pt: [number, number]): PathShape {
  if (cornerIndex === 0) return { ...shape, start: pt };
  return {
    ...shape,
    segments: shape.segments.map((seg, i) => (i === cornerIndex - 1 ? { ...seg, end: pt } : seg)),
  };
}

export function moveArcMid(shape: PathShape, segmentIndex: number, pt: [number, number]): PathShape {
  return {
    ...shape,
    segments: shape.segments.map((seg, i) => (i === segmentIndex && seg.kind === "arc" ? { ...seg, mid: pt } : seg)),
  };
}

const segStart = (shape: PathShape, i: number): [number, number] => (i === 0 ? shape.start : shape.segments[i - 1]!.end);

/**
 * Straight ↔ curved. A new arc bulges visibly (10 % of the chord,
 * perpendicular) so the user has a handle to drag — a collinear mid would be
 * a zero-curvature arc the server refuses.
 */
export function toggleSegment(shape: PathShape, segmentIndex: number): PathShape {
  const seg = shape.segments[segmentIndex];
  if (!seg) return shape;
  if (seg.kind === "arc") {
    return { ...shape, segments: shape.segments.map((s, i) => (i === segmentIndex ? { kind: "line", end: s.end } : s)) };
  }
  const a = segStart(shape, segmentIndex);
  const b = seg.end;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const mid: [number, number] = [(a[0] + b[0]) / 2 - dy * 0.1, (a[1] + b[1]) / 2 + dx * 0.1];
  return { ...shape, segments: shape.segments.map((s, i) => (i === segmentIndex ? { kind: "arc", mid, end: s.end } : s)) };
}

/** Splitting a side at `pt`: a line becomes two lines; an arc two arcs through sampled mids. */
export function insertCornerAfter(shape: PathShape, segmentIndex: number, pt: [number, number]): PathShape {
  const seg = shape.segments[segmentIndex];
  if (!seg) return shape;
  const a = segStart(shape, segmentIndex);
  const replacement: PathSegment[] =
    seg.kind === "line"
      ? [
          { kind: "line", end: pt },
          { kind: "line", end: seg.end },
        ]
      : (() => {
          const arc = arcInfo(a, seg.mid, seg.end);
          if (!arc) return [{ kind: "line", end: pt } as const, { kind: "line", end: seg.end } as const];
          // mids sampled ON the circle at the quarter points of each half
          const at = (t: number): [number, number] => [
            arc.cx + arc.r * Math.cos(arc.startAngle + arc.sweep * t),
            arc.cy + arc.r * Math.sin(arc.startAngle + arc.sweep * t),
          ];
          const split = at(0.5);
          return [
            { kind: "arc", mid: at(0.25), end: split } as const,
            { kind: "arc", mid: at(0.75), end: seg.end } as const,
          ];
        })();
  const segments = [...shape.segments.slice(0, segmentIndex), ...replacement, ...shape.segments.slice(segmentIndex + 1)];
  return { ...shape, segments };
}

/** Removing a corner merges its two sides into one straight side. */
export function removeCorner(shape: PathShape, cornerIndex: number, minCorners: number): PathShape | null {
  if (cornersOf(shape).length <= minCorners) return null;
  if (cornerIndex === 0) {
    const [first, ...rest] = shape.segments;
    return first ? { ...shape, start: first.end, segments: rest } : null;
  }
  const segIndex = cornerIndex - 1;
  const removed = shape.segments[segIndex];
  const next = shape.segments[segIndex + 1];
  if (!removed) return null;
  const merged: PathSegment[] = next
    ? [...shape.segments.slice(0, segIndex), { kind: "line", end: next.end }, ...shape.segments.slice(segIndex + 2)]
    : shape.segments.slice(0, segIndex);
  return { ...shape, segments: merged };
}

interface ArcInfo {
  cx: number;
  cy: number;
  r: number;
  startAngle: number;
  /** Signed sweep start→end passing through mid. */
  sweep: number;
}

/** The circle through three points, or null when collinear. */
export function arcInfo(a: [number, number], m: [number, number], b: [number, number]): ArcInfo | null {
  const d = 2 * (a[0] * (m[1] - b[1]) + m[0] * (b[1] - a[1]) + b[0] * (a[1] - m[1]));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a[0] * a[0] + a[1] * a[1];
  const m2 = m[0] * m[0] + m[1] * m[1];
  const b2 = b[0] * b[0] + b[1] * b[1];
  const cx = (a2 * (m[1] - b[1]) + m2 * (b[1] - a[1]) + b2 * (a[1] - m[1])) / d;
  const cy = (a2 * (b[0] - m[0]) + m2 * (a[0] - b[0]) + b2 * (m[0] - a[0])) / d;
  const r = Math.hypot(a[0] - cx, a[1] - cy);
  const angle = (p: [number, number]) => Math.atan2(p[1] - cy, p[0] - cx);
  const start = angle(a);
  const norm = (t: number) => ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const toMid = norm(angle(m) - start);
  const toEnd = norm(angle(b) - start);
  // the sweep runs through the mid: counter-clockwise if the mid comes first
  const sweep = toMid <= toEnd ? toEnd : toEnd - 2 * Math.PI;
  return { cx, cy, r, startAngle: start, sweep };
}

/** Display tessellation of the working copy — preview only, never sent. */
export function tessellateShape(shape: PathShape, perArc = 32): number[][] {
  const out: number[][] = [[...shape.start]];
  let from = shape.start;
  for (const seg of shape.segments) {
    if (seg.kind === "line") out.push([...seg.end]);
    else {
      const arc = arcInfo(from, seg.mid, seg.end);
      if (!arc) out.push([...seg.end]);
      else {
        for (let i = 1; i <= perArc; i += 1) {
          const t = arc.startAngle + (arc.sweep * i) / perArc;
          out.push([arc.cx + arc.r * Math.cos(t), arc.cy + arc.r * Math.sin(t)]);
        }
        out[out.length - 1] = [...seg.end];
      }
    }
    from = seg.end;
  }
  return out;
}

/** TRUE analytic path length in sheet points: straight sides + r·θ arcs — no chord figures. */
export function analyticLengthPt(shape: PathShape): number {
  let total = 0;
  let from = shape.start;
  for (const seg of shape.segments) {
    if (seg.kind === "line") total += Math.hypot(seg.end[0] - from[0], seg.end[1] - from[1]);
    else {
      const arc = arcInfo(from, seg.mid, seg.end);
      total += arc ? arc.r * Math.abs(arc.sweep) : Math.hypot(seg.end[0] - from[0], seg.end[1] - from[1]);
    }
    from = seg.end;
  }
  if (shape.closed) {
    const last = shape.segments[shape.segments.length - 1]?.end ?? shape.start;
    total += Math.hypot(shape.start[0] - last[0], shape.start[1] - last[1]);
  }
  return total;
}

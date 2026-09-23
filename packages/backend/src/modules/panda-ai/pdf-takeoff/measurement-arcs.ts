// Curved runs, measured as curves.
//
// A drain, a bay window or a radiused kerb is drawn as an arc, and a QS bills
// the length the pipe actually is — not the straight line between its ends.
// Tessellating the arc and summing the chords under-measures it (and the
// shortfall grows with the sweep), so the figure that reaches a bill line is
// the analytic arc length, and the figure that reaches the screen is a
// tessellation fine enough that the eye cannot see the difference.
//
// Every function here is pure and works in sheet points; metres arrive later,
// when the sheet's mm-per-point scale is applied.

/** A circular arc fixed by three points: it starts at `start`, passes through `mid`, ends at `end`. */
export interface ArcPoints {
  start: [number, number];
  mid: [number, number];
  end: [number, number];
}

interface ArcCircle {
  cx: number;
  cy: number;
  radius: number;
  /** Signed sweep in radians: positive is counter-clockwise, and |sweep| ≤ 2π. */
  sweep: number;
  startAngle: number;
}

const TAU = Math.PI * 2;

/** Wraps an angle difference into [0, 2π) so "which way round" can be decided. */
function normalise(angle: number): number {
  const wrapped = angle % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
}

/**
 * The circle through the three points, plus the signed sweep from start to end
 * that passes through mid. Returns null when the points are collinear (no
 * finite circle exists — the "arc" is a straight line).
 */
function circleThrough(arc: ArcPoints): ArcCircle | null {
  const [ax, ay] = arc.start;
  const [bx, by] = arc.mid;
  const [cx, cy] = arc.end;
  // twice the signed area of the triangle: zero means collinear
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (!Number.isFinite(d) || Math.abs(d) < 1e-12) return null;

  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const centreX = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const centreY = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  const radius = Math.hypot(ax - centreX, ay - centreY);
  if (!Number.isFinite(radius) || radius === 0) return null;

  const startAngle = Math.atan2(ay - centreY, ax - centreX);
  const midAngle = Math.atan2(by - centreY, bx - centreX);
  const endAngle = Math.atan2(cy - centreY, cx - centreX);
  // Going counter-clockwise from start, is mid reached before end? If so the
  // arc sweeps counter-clockwise; otherwise it is the clockwise complement.
  const toMid = normalise(midAngle - startAngle);
  const toEnd = normalise(endAngle - startAngle);
  const sweep = toMid <= toEnd ? toEnd : -(TAU - toEnd);
  return { cx: centreX, cy: centreY, radius, sweep, startAngle };
}

/**
 * Length of the arc in sheet points. The chord approximation is wrong by
 * 4.7 % on a quarter circle and 36 % on a half one, so a curved run is always
 * measured this way. NaN when the three points are collinear — a degenerate
 * arc is a straight line and the caller should measure it as one.
 */
export function arcLengthPt(arc: ArcPoints): number {
  const circle = circleThrough(arc);
  if (!circle) return Number.NaN;
  return circle.radius * Math.abs(circle.sweep);
}

/**
 * Signed area of the circular segment between the chord start→end and the arc
 * through mid. Shoelace measures the polygon as if every side were straight;
 * adding this per arc-bearing side corrects the total for the bulge, with the
 * sign that matches shoelace's own winding (counter-clockwise positive).
 * Zero for a collinear arc, which bulges by nothing.
 */
export function arcSignedAreaPt(arc: ArcPoints): number {
  const circle = circleThrough(arc);
  if (!circle) return 0;
  const { radius, sweep } = circle;
  return ((radius * radius) / 2) * (sweep - Math.sin(sweep));
}

/**
 * The arc as points, for drawing. Subdivision is adaptive: each sub-chord's
 * sagitta (its deepest departure from the true arc) is held at or under
 * `sagittaPx` device pixels, so a tight radius gets more points and zooming in
 * asks for more again. Includes both ends; never returns fewer than two points.
 */
export function tessellateArc(arc: ArcPoints, sagittaPx: number, cssZoom: number): [number, number][] {
  const circle = circleThrough(arc);
  if (!circle) return [arc.start, arc.end];

  const zoom = Number.isFinite(cssZoom) && cssZoom > 0 ? cssZoom : 1;
  const tolerance = Math.max(Number.isFinite(sagittaPx) && sagittaPx > 0 ? sagittaPx : 0.5, 1e-6) / zoom;
  const { radius, sweep, startAngle, cx, cy } = circle;

  // sagitta of a sub-arc of angle φ is R(1 − cos(φ/2)); invert for the widest φ
  // that still sits inside the tolerance. A tolerance past the radius means one
  // straight chord is already accurate enough.
  const ratio = 1 - Math.min(tolerance, radius) / radius;
  const maxStep = ratio <= -1 ? Math.PI : 2 * Math.acos(Math.max(-1, Math.min(1, ratio)));
  const steps = Math.max(2, Math.min(4096, Math.ceil(Math.abs(sweep) / Math.max(maxStep, 1e-6))));

  const points: [number, number][] = [arc.start];
  for (let i = 1; i < steps; i++) {
    const angle = startAngle + (sweep * i) / steps;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  points.push(arc.end);
  return points;
}

import type { MarkupPoint, MarkupRect } from "./markup-types";

// Geometry the SVG layer and the canvas share. Ported from the web's
// plan-review-markup.tsx (cloudPath, normalizedRect) and plan-review-data.ts
// (measureLabel), with the label in metres rather than feet-and-inches — a
// site crew here reads a tape in metres.

export function normalizedRect(a: MarkupPoint, b: MarkupPoint): MarkupRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

/**
 * Revision-cloud outline: a rectangle whose edges are drawn as a run of small
 * outward arcs (the standard "cloud" annotation on construction drawings).
 * `rect` and `bump` are in the same units — the web draws in a 0–100 viewBox
 * with a 2.2 bump; this layer draws in sheet pixels, so the caller scales it.
 */
export function cloudPath(rect: MarkupRect, bump: number): string {
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

/**
 * Length of a measure line as a percentage of sheet width. Percent-y is
 * squashed by the aspect so a vertical and a horizontal line of the same
 * real length come out equal — the web's measureLabel does the same.
 */
export function measureDistancePct(a: MarkupPoint, b: MarkupPoint, aspect: number): number {
  const dxPct = b.x - a.x;
  const dyPct = (b.y - a.y) * aspect;
  return Math.hypot(dxPct, dyPct);
}

export const NO_SCALE_LABEL = "no scale set";

/** What a measure line says: a length in sheet units, or that it cannot yet. */
export function measureLabel(a: MarkupPoint, b: MarkupPoint, aspect: number, metresPerPct: number | null): string {
  if (!metresPerPct) return NO_SCALE_LABEL;
  return formatMetres(measureDistancePct(a, b, aspect) * metresPerPct);
}

export function formatMetres(metres: number): string {
  if (metres < 1) return `${Math.round(metres * 1000)} mm`;
  return `${metres.toFixed(2)} m`;
}

/** Metres per percent of sheet width, from a line of a known real length. */
export function metresPerPctFromLine(a: MarkupPoint, b: MarkupPoint, aspect: number, metres: number): number | null {
  const dist = measureDistancePct(a, b, aspect);
  if (!(metres > 0) || dist <= 0) return null;
  return metres / dist;
}

export interface Tick {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A short line square to the measure at each end, like a dimension line's ticks. */
export function measureTicks(a: { x: number; y: number }, b: { x: number; y: number }, half: number): [Tick, Tick] {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  // unit normal to the line
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  const tick = (p: { x: number; y: number }): Tick => ({
    x1: p.x - nx * half,
    y1: p.y - ny * half,
    x2: p.x + nx * half,
    y2: p.y + ny * half,
  });
  return [tick(a), tick(b)];
}

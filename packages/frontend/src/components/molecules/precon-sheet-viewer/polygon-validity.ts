// Pure polygon checks for the drawing tools and the inspector's quantity
// formula. No React, no imports: `polygon-validity.test.ts` runs under the
// plain node runner.

function orientation(a: readonly number[], b: readonly number[], c: readonly number[]): number {
  const cross = (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
  if (Math.abs(cross) < 1e-12) return 0;
  return cross > 0 ? 1 : -1;
}

function segmentsCross(a1: readonly number[], a2: readonly number[], b1: readonly number[], b2: readonly number[]): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}

/** Whether the polygon CLOSED through these vertices crosses itself (a bow-tie). */
export function polygonSelfIntersects(vertices: readonly number[][]): boolean {
  const n = vertices.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = vertices[i]!;
    const a2 = vertices[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      // neighbouring segments share an endpoint and never "cross"
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      if (segmentsCross(a1, a2, vertices[j]!, vertices[(j + 1) % n]!)) return true;
    }
  }
  return false;
}

/**
 * The first anchor when a click lands within `thresholdPt` of it and the
 * polygon already has enough points to close — the click closes the shape.
 */
export function firstVertexCloseTarget(anchors: readonly number[][], click: readonly number[], thresholdPt: number): number[] | null {
  const first = anchors[0];
  if (!first || anchors.length < 3) return null;
  return Math.hypot(click[0]! - first[0]!, click[1]! - first[1]!) <= thresholdPt ? [first[0]!, first[1]!] : null;
}

interface FormulaArgs {
  gross: number | null;
  deductions: number | null;
  typical: number;
  net: number | null;
  unit: string | null;
}

/** `(gross − deductions) × N = net unit` — always parenthesised (contract 5). */
export function formulaParts({ gross, deductions, typical, net, unit }: FormulaArgs): string {
  const show = (value: number | null) => (value === null ? "—" : String(Math.round(value * 100) / 100));
  return `(${show(gross)} − ${show(deductions ?? 0)}) × ${typical} = ${show(net)}${unit ? ` ${unit}` : ""}`;
}

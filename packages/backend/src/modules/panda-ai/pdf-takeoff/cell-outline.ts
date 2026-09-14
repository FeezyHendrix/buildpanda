// Tracing a flood-filled region back into a polygon. Both take-off engines
// fill a raster of the wall lines and then need the boundary of that fill as
// a polygon: the PDF room picker in sheet points, the DWG engine in drawing
// units. Only the mapping from a grid corner to a point differs, so the
// caller passes it and everything else is shared.

export type CellToPoint = (i: number, j: number) => number[];

// Boundary edges of the filled cells, oriented so the fill sits on the right
// of travel, walked from the top-left cell preferring the turn that hugs the
// outside: one loop around the whole region, pinch points and all.
function traceOutline(cells: Uint8Array, cols: number, rows: number): number[][] {
  const key = (i: number, j: number) => j * (cols + 1) + i;
  const edges = new Map<number, Array<[number, number, number, number]>>(); // start corner → [i, j, di, dj]
  const add = (i: number, j: number, di: number, dj: number) => {
    const k = key(i, j);
    const list = edges.get(k);
    if (list) list.push([i, j, di, dj]);
    else edges.set(k, [[i, j, di, dj]]);
  };
  let start: [number, number] | null = null;
  const filled = (x: number, y: number) => x >= 0 && x < cols && y >= 0 && y < rows && cells[y * cols + x] === 1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!filled(x, y)) continue;
      if (!start) start = [x, y];
      if (!filled(x, y - 1)) add(x, y, 1, 0);
      if (!filled(x + 1, y)) add(x + 1, y, 0, 1);
      if (!filled(x, y + 1)) add(x + 1, y + 1, -1, 0);
      if (!filled(x - 1, y)) add(x, y + 1, 0, -1);
    }
  }
  if (!start) return [];
  const corners: number[][] = [];
  let [i, j] = start;
  let di = 1;
  let dj = 0;
  const startKey = key(i, j);
  for (let guard = 0; guard < edges.size + 1; guard++) {
    corners.push([i, j]);
    const list = edges.get(key(i, j));
    if (!list || list.length === 0) break;
    // left turn first (hugs the exterior), then straight, then right
    const prefs: Array<[number, number]> = [
      [dj, -di],
      [di, dj],
      [-dj, di],
    ];
    let pick = -1;
    for (const [px, py] of prefs) {
      pick = list.findIndex((e) => e[2] === px && e[3] === py);
      if (pick >= 0) break;
    }
    if (pick < 0) pick = 0;
    const [, , ndi, ndj] = list.splice(pick, 1)[0]!;
    di = ndi;
    dj = ndj;
    i += di;
    j += dj;
    if (key(i, j) === startKey) break;
  }
  return corners;
}

// Consecutive cell edges along one straight run collapse to their ends; a
// corner then moves half a cell outward, because the wall line sits inside
// its own cell and the true face is on average half a cell beyond the fill.
function tidy(corners: number[][], cellToPoint: CellToPoint, eps: number): number[][] {
  const n = corners.length;
  if (n < 4) return [];
  const kept: number[][] = [];
  for (let k = 0; k < n; k++) {
    const a = corners[(k - 1 + n) % n]!;
    const b = corners[k]!;
    const c = corners[(k + 1) % n]!;
    const straight = (b[0]! - a[0]!) * (c[1]! - b[1]!) - (b[1]! - a[1]!) * (c[0]! - b[0]!) === 0;
    if (!straight) kept.push(b);
  }
  const m = kept.length;
  const out: number[][] = [];
  for (let k = 0; k < m; k++) {
    const a = kept[(k - 1 + m) % m]!;
    const b = kept[k]!;
    const c = kept[(k + 1) % m]!;
    const inn = [Math.sign(b[0]! - a[0]!), Math.sign(b[1]! - a[1]!)];
    const outd = [Math.sign(c[0]! - b[0]!), Math.sign(c[1]! - b[1]!)];
    // exterior is on the left of travel: normal (dy, -dx)
    const nx = (inn[1]! + outd[1]!) / 2;
    const ny = (-inn[0]! - outd[0]!) / 2;
    out.push(cellToPoint(b[0]! + nx * 0.5, b[1]! + ny * 0.5));
  }
  return simplify(out, eps);
}

function pointLineDistance(p: number[], a: number[], b: number[]): number {
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0]! - a[0]!, p[1]! - a[1]!);
  return Math.abs(dy * p[0]! - dx * p[1]! + b[0]! * a[1]! - b[1]! * a[0]!) / len;
}

/** Runs of near-collinear points (staircases along an angled wall) become one straight edge. */
export function simplify(points: number[][], eps: number): number[][] {
  const n = points.length;
  if (n < 4) return points;
  const out: number[][] = [points[0]!];
  let i = 0;
  while (i < n - 1) {
    let j = i + 1;
    while (j + 1 < n) {
      const a = points[i]!;
      const b = points[j + 1]!;
      let within = true;
      for (let k = i + 1; k <= j; k++) {
        if (pointLineDistance(points[k]!, a, b) > eps) {
          within = false;
          break;
        }
      }
      if (!within) break;
      j++;
    }
    out.push(points[j]!);
    i = j;
  }
  // the closing run: drop the last point when it lies on first→second-last
  if (out.length >= 4 && pointLineDistance(out[out.length - 1]!, out[out.length - 2]!, out[0]!) <= eps) out.pop();
  return out;
}

/**
 * The outline of the filled cells as a polygon in the caller's coordinates.
 * `cellToPoint` maps a grid corner — possibly a half cell, since corners move
 * outward onto the true face — to a point; the simplification tolerance is
 * three quarters of a cell, measured through that same mapping.
 */
export function traceCells(cells: Uint8Array, cols: number, rows: number, cellToPoint: CellToPoint): number[][] {
  const origin = cellToPoint(0, 0);
  const step = cellToPoint(1, 0);
  const eps = Math.hypot(step[0]! - origin[0]!, step[1]! - origin[1]!) * 0.75;
  return tidy(traceOutline(cells, cols, rows), cellToPoint, eps);
}

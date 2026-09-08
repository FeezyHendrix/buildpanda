import type { GeoSegment, GeoText, RoomAtResult, SheetGeometry } from "./types.ts";

// "Room fill": the person clicks inside a space and gets its outline. The
// sheet's segments are stamped into a fine grid around the click, the open
// cells are flood-filled from it, and the boundary of the fill is traced
// back into a polygon in sheet points. A fill that reaches the edge of the
// search window is retried on a morphologically closed grid (doors and
// small gaps sealed); one that still leaks is not a room.

const GRID_MM = 25;
const MAX_CELLS_PER_AXIS = 2000;
// how far a room can extend from the click, and how large it can be
const REACH_MM = 30_000;
const MAX_ROOM_M2 = 1500;
const CLOSING_REACH_MM = 500;
const SEED_SEARCH_CELLS = 3;
const MAX_LABEL_CHARS = 30;
const ROOM_WORDS =
  /bed|toilet|bath|kitchen|living|lounge|dining|office|store|reception|lobby|corridor|hall|waiting|conference|meeting|laundry|garage|balcony|terrace|veranda|pantry|study|staff|server|library|clinic|ward|gym|studio|shop|cafe|canteen|dressing|wardrobe|closet|lift|entrance|foyer|porch|utility|suite|shower|nursery|cellar|basement|plant|room|class|lab\b|workshop|warehouse|passage|wc|whb/i;
const NOT_A_LABEL = /^[+-]?[\d.,'"°/ -]+$|\bmm\b|\bm2\b|sq\.?\s*m|plan|elevation|section|scale|detail|note|level|schedule|legend/i;

export interface RoomAtOptions {
  // segments thinner than this are furniture and hatches, not walls (PDF pens; 0 keeps everything)
  penPt?: number;
}

interface Grid {
  cols: number;
  rows: number;
  cellPt: number;
  minX: number;
  minY: number;
}

interface Fill {
  cells: Uint8Array;
  leaked: boolean;
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function stamp(grid: Grid, mask: Uint8Array, segments: GeoSegment[]): void {
  const { cols, rows, cellPt, minX, minY } = grid;
  for (const s of segments) {
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    const steps = Math.max(1, Math.ceil(len / (cellPt / 2)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = Math.floor((s.x1 + (s.x2 - s.x1) * t - minX) / cellPt);
      const cy = Math.floor((s.y1 + (s.y2 - s.y1) * t - minY) / cellPt);
      if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) mask[cy * cols + cx] = 1;
    }
  }
}

function flood(grid: Grid, mask: Uint8Array, start: number, maxCells: number): Fill {
  const { cols, rows } = grid;
  const cells = new Uint8Array(cols * rows);
  const stack = [start];
  cells[start] = 1;
  let count = 0;
  let leaked = false;
  while (stack.length) {
    const idx = stack.pop()!;
    if (++count > maxCells) return { cells, leaked: true };
    const x = idx % cols;
    const y = (idx - x) / cols;
    // reaching the window's edge means the space is open: no point filling on
    if (x === 0 || x === cols - 1 || y === 0 || y === rows - 1) return { cells, leaked: true };
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const n = ny * cols + nx;
      if (mask[n] || cells[n]) continue;
      cells[n] = 1;
      stack.push(n);
    }
  }
  return { cells, leaked };
}

/** Separable max filter: a cell takes `value` when any cell within r (Chebyshev) has it. */
function dilate(src: Uint8Array, cols: number, rows: number, r: number, value: number): Uint8Array {
  const pass = new Uint8Array(src.length);
  for (let y = 0; y < rows; y++) {
    let count = 0;
    for (let x = -r; x < cols; x++) {
      if (x + r < cols && src[y * cols + x + r] === value) count++;
      if (x - r - 1 >= 0 && src[y * cols + x - r - 1] === value) count--;
      if (x >= 0) pass[y * cols + x] = count > 0 ? value : 1 - value;
    }
  }
  const out = new Uint8Array(src.length);
  for (let x = 0; x < cols; x++) {
    let count = 0;
    for (let y = -r; y < rows; y++) {
      if (y + r < rows && pass[(y + r) * cols + x] === value) count++;
      if (y - r - 1 >= 0 && pass[(y - r - 1) * cols + x] === value) count--;
      if (y >= 0) out[y * cols + x] = count > 0 ? value : 1 - value;
    }
  }
  return out;
}

function closed(mask: Uint8Array, cols: number, rows: number, r: number): Uint8Array {
  const out = dilate(dilate(mask, cols, rows, r, 1), cols, rows, r, 0);
  for (let i = 0; i < mask.length; i++) if (mask[i]) out[i] = 1;
  return out;
}

// Open cells around the click, nearest ring first: a click on a wall line
// has a room on one side and the outside (or the next room) on the other,
// so every candidate is tried until one encloses.
function openCellsNear(grid: Grid, mask: Uint8Array, cx: number, cy: number): number[] {
  const out: number[] = [];
  for (let r = 0; r <= SEED_SEARCH_CELLS; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= grid.cols || y < 0 || y >= grid.rows) continue;
        if (!mask[y * grid.cols + x]) out.push(y * grid.cols + x);
      }
    }
  }
  return out;
}

// Boundary edges of the filled cells, oriented so the fill sits on the
// right of travel, walked from the top-left cell preferring the turn that
// hugs the outside: one loop around the whole region, pinch points and all.
function traceOutline(grid: Grid, cells: Uint8Array): number[][] {
  const { cols, rows } = grid;
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
function tidy(corners: number[][], grid: Grid): number[][] {
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
    out.push([grid.minX + (b[0]! + nx * 0.5) * grid.cellPt, grid.minY + (b[1]! + ny * 0.5) * grid.cellPt]);
  }
  return simplify(out, grid.cellPt * 0.75);
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

export function polygonArea(vertices: number[][]): number {
  let doubled = 0;
  for (let i = 0; i < vertices.length; i++) {
    const [x1, y1] = vertices[i]!;
    const [x2, y2] = vertices[(i + 1) % vertices.length]!;
    doubled += x1! * y2! - x2! * y1!;
  }
  return Math.abs(doubled / 2);
}

export function pointInPolygon(x: number, y: number, polygon: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi! > y !== yj! > y && x < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!) inside = !inside;
  }
  return inside;
}

function labelInside(texts: GeoText[], polygon: number[][], x: number, y: number): string | null {
  const inside = texts.filter((t) => {
    const str = t.str.trim();
    if (!str || str.length > MAX_LABEL_CHARS || (str.match(/[A-Za-z]/g) ?? []).length < 2 || NOT_A_LABEL.test(str)) return false;
    return pointInPolygon(t.x + t.w / 2, t.y, polygon);
  });
  if (!inside.length) return null;
  const score = (t: GeoText) => (ROOM_WORDS.test(t.str) ? 0 : 1e9) + Math.hypot(t.x + t.w / 2 - x, t.y - y);
  return inside.sort((a, b) => score(a) - score(b))[0]!.str.trim();
}

/** The enclosed space around a point, or null when the fill runs out to the open. */
export function roomAt(geo: SheetGeometry, point: [number, number], mmPerPt: number, opts: RoomAtOptions = {}): RoomAtResult | null {
  const penPt = opts.penPt ?? 0;
  const walls = geo.segments.filter((s) => s.width >= penPt - 1e-6);
  const reach = REACH_MM / mmPerPt;
  const window = { minX: point[0] - reach, minY: point[1] - reach, maxX: point[0] + reach, maxY: point[1] + reach };
  if (geo.bounds) {
    // one cell of margin so a face on the sheet's edge still has an outside
    window.minX = Math.max(window.minX, geo.bounds.minX - GRID_MM / mmPerPt);
    window.minY = Math.max(window.minY, geo.bounds.minY - GRID_MM / mmPerPt);
    window.maxX = Math.min(window.maxX, geo.bounds.maxX + GRID_MM / mmPerPt);
    window.maxY = Math.min(window.maxY, geo.bounds.maxY + GRID_MM / mmPerPt);
  }
  const extentPt = Math.max(window.maxX - window.minX, window.maxY - window.minY);
  if (extentPt <= 0) return null;
  const gridMm = Math.max(GRID_MM, (extentPt * mmPerPt) / MAX_CELLS_PER_AXIS);
  const cellPt = gridMm / mmPerPt;
  const grid: Grid = {
    cols: Math.ceil((window.maxX - window.minX) / cellPt) + 1,
    rows: Math.ceil((window.maxY - window.minY) / cellPt) + 1,
    cellPt,
    minX: window.minX,
    minY: window.minY,
  };
  if (grid.cols < 10 || grid.rows < 10) return null;
  const mask = new Uint8Array(grid.cols * grid.rows);
  stamp(grid, mask, walls);
  const cx = Math.floor((point[0] - grid.minX) / cellPt);
  const cy = Math.floor((point[1] - grid.minY) / cellPt);
  const maxCells = Math.ceil(MAX_ROOM_M2 / (gridMm / 1000) ** 2);
  let sealed: Uint8Array | null = null;
  const sealedMask = () => (sealed ??= closed(mask, grid.cols, grid.rows, Math.min(30, Math.round(CLOSING_REACH_MM / gridMm))));

  let fill: Fill | null = null;
  for (const start of openCellsNear(grid, mask, cx, cy)) {
    const raw = flood(grid, mask, start, maxCells);
    if (!raw.leaked) {
      fill = raw;
      break;
    }
    if (sealedMask()[start]) continue;
    const closedFill = flood(grid, sealedMask(), start, maxCells);
    if (!closedFill.leaked) {
      fill = closedFill;
      break;
    }
  }
  if (!fill) return null;
  const vertices = tidy(traceOutline(grid, fill.cells), grid).map(([x, y]) => [Math.round(x! * 100) / 100, Math.round(y! * 100) / 100]);
  if (vertices.length < 3) return null;
  const toM = mmPerPt / 1000;
  return { vertices, label: labelInside(geo.texts, vertices, point[0], point[1]), areaM2: Math.round(polygonArea(vertices) * toM * toM * 100) / 100 };
}

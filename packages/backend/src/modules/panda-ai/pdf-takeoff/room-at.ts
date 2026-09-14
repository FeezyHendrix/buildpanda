import { simplify, traceCells } from "./cell-outline.ts";
import type { GeoSegment, GeoText, RoomAtResult, SheetGeometry } from "./types.ts";

// the tracer moved to cell-outline.ts, where the DWG room fill shares it
export { simplify };

// "Room fill": the person clicks inside a space and gets its outline. The
// sheet's segments are stamped into a fine grid around the click, the open
// cells are flood-filled from it, and the boundary of the fill is traced
// back into a polygon in sheet points. A fill that reaches the edge of the
// search window is retried on a morphologically closed grid (doors and
// small gaps sealed); one that still leaks is not a room.

const GRID_MM = 25;
// narrower than this and the enclosure is a wall cavity or a duct, not a room
const MIN_ROOM_WIDTH_MM = 600;
const MAX_SEED_TRIES = 400;
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
  // filled cells, and filled cells touching a wall (the region's perimeter)
  count: number;
  edgeCount: number;
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
  let edgeCount = 0;
  let leaked = false;
  while (stack.length) {
    const idx = stack.pop()!;
    if (++count > maxCells) return { cells, leaked: true, count, edgeCount };
    const x = idx % cols;
    const y = (idx - x) / cols;
    // reaching the window's edge means the space is open: no point filling on
    if (x === 0 || x === cols - 1 || y === 0 || y === rows - 1) return { cells, leaked: true, count, edgeCount };
    let onEdge = false;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const n = ny * cols + nx;
      if (mask[n]) {
        onEdge = true;
        continue;
      }
      if (cells[n]) continue;
      cells[n] = 1;
      stack.push(n);
    }
    if (onEdge) edgeCount += 1;
  }
  return { cells, leaked, count, edgeCount };
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
  // on a DWG the layer says what a line is: fill against walls and columns,
  // and let doors and windows seal an opening only when the room leaks
  const tagged = geo.segments.some((s) => s.element !== undefined);
  const isWall = (s: GeoSegment) => (tagged ? s.element === "walls" || s.element === "columns" : s.width >= penPt - 1e-6);
  const walls = geo.segments.filter(isWall);
  const openings = tagged ? geo.segments.filter((s) => s.element === "doors" || s.element === "windows") : [];
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
  let withOpenings: Uint8Array | null = null;
  const openingsMask = () => {
    if (withOpenings) return withOpenings;
    withOpenings = new Uint8Array(mask);
    stamp(grid, withOpenings, openings);
    return withOpenings;
  };
  const sealedMask = () => (sealed ??= closed(openings.length ? openingsMask() : mask, grid.cols, grid.rows, Math.min(30, Math.round(CLOSING_REACH_MM / gridMm))));

  // The gap between a wall's two faces is an enclosed region too. A room
  // is at least MIN_ROOM_WIDTH_MM wide somewhere; a cavity is not, and
  // area / perimeter ≈ half the width of a long thin shape.
  const minWidthCells = MIN_ROOM_WIDTH_MM / gridMm;
  const isRoom = (f: Fill): boolean => f.count >= minWidthCells * minWidthCells && f.count / Math.max(1, f.edgeCount) >= minWidthCells / 4;

  let fill: Fill | null = null;
  let tried = 0;
  for (const start of openCellsNear(grid, mask, cx, cy)) {
    if (tried++ > MAX_SEED_TRIES) break;
    const raw = flood(grid, mask, start, maxCells);
    if (!raw.leaked && isRoom(raw)) {
      fill = raw;
      break;
    }
    if (openings.length && !openingsMask()[start]) {
      const doored = flood(grid, openingsMask(), start, maxCells);
      if (!doored.leaked && isRoom(doored)) {
        fill = doored;
        break;
      }
    }
    if (sealedMask()[start]) continue;
    const closedFill = flood(grid, sealedMask(), start, maxCells);
    if (!closedFill.leaked && isRoom(closedFill)) {
      fill = closedFill;
      break;
    }
  }
  if (!fill) return null;
  const toPoint = (i: number, j: number) => [grid.minX + i * grid.cellPt, grid.minY + j * grid.cellPt];
  const vertices = traceCells(fill.cells, grid.cols, grid.rows, toPoint).map(([x, y]) => [Math.round(x! * 100) / 100, Math.round(y! * 100) / 100]);
  if (vertices.length < 3) return null;
  const toM = mmPerPt / 1000;
  return { vertices, label: labelInside(geo.texts, vertices, point[0], point[1]), areaM2: Math.round(polygonArea(vertices) * toM * toM * 100) / 100 };
}

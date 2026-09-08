import type { WallSegment } from "./walls.ts";

// Room areas by flood fill on a raster of the wall faces. The DWG gives exact
// geometry, so the grid is fine (20 mm) and the fill is corrected for the
// half-cell the face lines occupy. The mask is the walls plus the bridged
// openings; a seed that reaches the outside, or another room's label, is
// retried with the door and window geometry added, then once more on a
// morphologically closed grid.

export interface RoomSeed {
  name: string;
  x: number;
  y: number;
  known: boolean;
}

export type SealLevel = "walls" | "openings" | "closed";

export interface FilledRoom {
  name: string;
  areaM2: number;
  perimeterM: number;
  known: boolean;
  seed: [number, number];
  sealed: SealLevel;
  // other room labels inside the same enclosure (an open plan)
  sharedWith: string[];
}

export type FillFailure = "leaked" | "on a wall" | "too small" | "too large" | "already filled";

export interface FillOutcome {
  rooms: FilledRoom[];
  unmeasured: Array<{ name: string; why: FillFailure }>;
  cellMm: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const MIN_CELL_MM = 20;
const MAX_CELLS_PER_SIDE = 3000;
const MIN_ROOM_M2 = 1;
// a fill that covers more of the sheet than this is the whole floor: open plan
const MAX_ROOM_SHARE = 0.6;
const CLOSING_MM = 500;

interface Grid {
  mask: Uint8Array;
  outside: Uint8Array; // cells reachable from the margin: not in any room
}

export function fillRooms(mask: WallSegment[], extras: WallSegment[], seeds: RoomSeed[], bounds: Bounds, scaleToMm: number): FillOutcome {
  const spanMm = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * scaleToMm;
  const cellMm = Math.max(MIN_CELL_MM, Math.ceil(spanMm / MAX_CELLS_PER_SIDE));
  const cell = cellMm / scaleToMm;
  // one cell of margin so a face on the boundary still has an outside
  const cols = Math.ceil((bounds.maxX - bounds.minX) / cell) + 3;
  const rows = Math.ceil((bounds.maxY - bounds.minY) / cell) + 3;
  const outcome: FillOutcome = { rooms: [], unmeasured: [], cellMm };
  if (cols < 10 || rows < 10) return outcome;
  const col = (x: number) => Math.floor((x - bounds.minX) / cell) + 1;
  const row = (y: number) => Math.floor((y - bounds.minY) / cell) + 1;
  const stamp = (grid: Uint8Array, segments: WallSegment[]) => {
    for (const s of segments) {
      const steps = Math.max(1, Math.ceil(s.len / (cell / 2)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = col(s.x1 + (s.x2 - s.x1) * t);
        const cy = row(s.y1 + (s.y2 - s.y1) * t);
        if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) grid[cy * cols + cx] = 1;
      }
    }
    return grid;
  };
  const variant = (m: Uint8Array): Grid => ({ mask: m, outside: reachableFrom(m, cols, rows, 0) });
  const walls = variant(stamp(new Uint8Array(cols * rows), mask));
  let withOpenings: Grid | null = null;
  let closed: Grid | null = null;
  const openingsGrid = () => (withOpenings ??= variant(stamp(new Uint8Array(walls.mask), extras)));
  const closedGrid = () => (closed ??= variant(close(openingsGrid().mask, cols, rows, Math.min(30, Math.round(CLOSING_MM / cellMm)))));
  const attempts: Array<[SealLevel, () => Grid]> = [
    ["walls", () => walls],
    ["openings", openingsGrid],
    ["closed", closedGrid],
  ];

  const ordered = [...seeds].sort((a, b) => Number(b.known) - Number(a.known) || b.name.length - a.name.length);
  const starts = ordered.map((seed) => openCellNear(walls.mask, cols, rows, col(seed.x), row(seed.y)));
  const claimed = new Uint8Array(cols * rows);
  const cellAreaM2 = (cellMm / 1000) ** 2;
  const maxCells = MAX_ROOM_SHARE * cols * rows;
  ordered.forEach((seed, k) => {
    const start = starts[k]!;
    if (start === null) {
      outcome.unmeasured.push({ name: seed.name, why: "on a wall" });
      return;
    }
    if (claimed[start]) {
      outcome.unmeasured.push({ name: seed.name, why: "already filled" });
      return;
    }
    let accepted: { fill: Fill; sealed: SealLevel; others: string[] } | null = null;
    let why: FillFailure = "leaked";
    for (const [level, grid] of attempts) {
      const g = grid();
      if (g.mask[start] || g.outside[start]) continue;
      const fill = flood(g.mask, cols, rows, start, maxCells);
      if (fill.tooLarge) {
        why = "too large";
        continue;
      }
      const others = ordered.filter((_, j) => j !== k && starts[j] !== null && fill.seen[starts[j]!]).map((o) => o.name);
      // one enclosure holding two room labels is not sealed yet: try harder,
      // but keep it in case the plan really is open
      if (!others.length) {
        accepted = { fill, sealed: level, others };
        break;
      }
      accepted ??= { fill, sealed: level, others };
    }
    if (!accepted) {
      outcome.unmeasured.push({ name: seed.name, why });
      return;
    }
    const { fill, sealed, others } = accepted;
    // the face line's cell is half wall, half room on average
    const areaM2 = Math.round((fill.cells.length + fill.boundary / 2) * cellAreaM2 * 100) / 100;
    if (areaM2 < MIN_ROOM_M2) {
      outcome.unmeasured.push({ name: seed.name, why: "too small" });
      return;
    }
    for (const c of fill.cells) claimed[c] = 1;
    const perimeterM = Math.round((fill.boundary * cellMm) / 10) / 100;
    outcome.rooms.push({ name: seed.name, areaM2, perimeterM, known: seed.known, seed: [seed.x, seed.y], sealed, sharedWith: others });
  });
  return outcome;
}

/** The seed cell, or the nearest open cell within three cells of it. */
function openCellNear(grid: Uint8Array, cols: number, rows: number, cx: number, cy: number): number | null {
  for (let r = 0; r <= 3; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
        if (!grid[y * cols + x]) return y * cols + x;
      }
    }
  }
  return null;
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Every open cell connected to `start`, as a mark array (no cell list: this runs over the whole outside). */
function reachableFrom(mask: Uint8Array, cols: number, rows: number, start: number): Uint8Array {
  const seen = new Uint8Array(cols * rows);
  if (mask[start]) return seen;
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % cols;
    const y = (idx - x) / cols;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const n = ny * cols + nx;
      if (mask[n] || seen[n]) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }
  return seen;
}

interface Fill {
  cells: number[];
  boundary: number;
  seen: Uint8Array;
  tooLarge: boolean;
}

function flood(mask: Uint8Array, cols: number, rows: number, start: number, maxCells: number): Fill {
  const seen = new Uint8Array(cols * rows);
  const touched = new Uint8Array(cols * rows);
  const stack = [start];
  const cells: number[] = [];
  let boundary = 0;
  seen[start] = 1;
  while (stack.length) {
    const idx = stack.pop()!;
    cells.push(idx);
    if (cells.length > maxCells) return { cells, boundary, seen, tooLarge: true };
    const x = idx % cols;
    const y = (idx - x) / cols;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const n = ny * cols + nx;
      if (mask[n]) {
        if (!touched[n]) {
          touched[n] = 1;
          boundary++;
        }
        continue;
      }
      if (seen[n]) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }
  return { cells, boundary, seen, tooLarge: false };
}

/** Morphological closing with a square element of radius r: seals gaps up to 2r cells. */
function close(grid: Uint8Array, cols: number, rows: number, r: number): Uint8Array {
  const dilated = dilate(grid, cols, rows, r, 1);
  const eroded = dilate(dilated, cols, rows, r, 0);
  for (let i = 0; i < grid.length; i++) if (grid[i]) eroded[i] = 1;
  return eroded;
}

/** Separable max filter: a cell takes `value` when any cell within r (Chebyshev) has it. */
function dilate(src: Uint8Array, cols: number, rows: number, r: number, value: number): Uint8Array {
  const pass1 = new Uint8Array(src.length);
  for (let y = 0; y < rows; y++) {
    const base = y * cols;
    let count = 0;
    for (let x = -r; x < cols; x++) {
      const add = x + r;
      const drop = x - r - 1;
      if (add < cols && src[base + add] === value) count++;
      if (drop >= 0 && src[base + drop] === value) count--;
      if (x >= 0) pass1[base + x] = count > 0 ? value : 1 - value;
    }
  }
  const out = new Uint8Array(src.length);
  for (let x = 0; x < cols; x++) {
    let count = 0;
    for (let y = -r; y < rows; y++) {
      const add = y + r;
      const drop = y - r - 1;
      if (add < rows && pass1[add * cols + x] === value) count++;
      if (drop >= 0 && pass1[drop * cols + x] === value) count--;
      if (y >= 0) out[y * cols + x] = count > 0 ? value : 1 - value;
    }
  }
  return out;
}

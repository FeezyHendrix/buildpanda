import type { DrawingRegion, Segment, TextRun } from "../types.ts";

// ---------- floor areas: wall-mask flood fill seeded from room labels ----------

const GRID_MM = 25;
const MAX_CELLS_PER_AXIS = 2000;
const MAX_ROOM_M2 = 500;
const MIN_ROOM_M2 = 1;
// the closing seals openings up to ~1 m (500 mm of dilation each side)
const CLOSING_REACH_MM = 500;
const DEFAULT_PEN_PT = 0.15;

// Room labels come in every case ("Toilet", "kitchenette", "STORE", "OFFICE
// 12"); accept word-like text with an optional number and let the leak/area
// filters kill bad seeds. Known room words are seeded first so a furniture
// code inside the same room cannot claim its name.
const ROOM_LABEL = /^[A-Za-z][A-Za-z .'/-]{1,28}(?:\s*\d{1,3})?$/;
const SHORT_ROOM_WORDS = new Set(["wc", "whb"]);
const ROOM_WORDS =
  /bed|toilet|bath|kitchen|living|lounge|dining|office|store|reception|lobby|corridor|hall|waiting|conference|meeting|laundry|garage|balcony|terrace|veranda|pantry|study|staff|server|record|library|clinic|ward|prayer|mail|copy|print|gym|studio|shop|kiosk|cafe|canteen|dressing|wardrobe|closet|lift|entrance|foyer|porch|utility|suite|shower|nursery|cellar|basement|plant|flat\b|unit\b|room|class|lab\b|theatre|workshop|warehouse|passage|ante/i;
const ROOM_LABEL_BLOCKLIST =
  /plan|elevation|section|scale|detail|note|drawing|project|sheet|level|general|legend|schedule|title|type|mark|date|drawn|checked|approved|designed|sign|furniture|equipment|miscelan|desk|chair|computer|phone|machine|couch|cabinate|cabinet|blinde|planter|dust bin/i;

export interface RoomArea {
  name: string;
  areaM2: number;
  seed: number[];
  // measured on the raw walls, or only after the closing pass sealed an opening
  sealed: boolean;
}

export interface RoomMeasurement {
  rooms: RoomArea[];
  // room labels inside the region that could not be filled: leaked to the
  // region edge, sat on a wall, or came out at an implausible size
  unfilled: string[];
}

export interface RoomOptions {
  // segments at or above this pen are walls; default keeps the legacy fixed pen
  penPt?: number;
  // extra barriers stamped into the wall mask: bridges across door and window
  // openings so a room does not leak through them
  bridges?: Segment[];
}

function isRoomLabel(t: TextRun): boolean {
  if (t.rotated) return false;
  const str = t.str.trim();
  if (SHORT_ROOM_WORDS.has(str.toLowerCase())) return true;
  if (!ROOM_LABEL.test(str) || str.length < 3) return false;
  if (ROOM_LABEL_BLOCKLIST.test(str)) return false;
  if (/^[wd]-?\d{1,2}$/i.test(str)) return false; // opening tags
  return ROOM_WORDS.test(str);
}

export function measureRooms(segments: Segment[], texts: TextRun[], region: DrawingRegion, mmPerPt: number, opts: RoomOptions = {}): RoomMeasurement {
  const penPt = opts.penPt ?? DEFAULT_PEN_PT;
  const extentPt = Math.max(region.maxX - region.minX, region.maxY - region.minY);
  // 25 mm cells unless the region is so large the grid would blow its cap
  const gridMm = Math.max(GRID_MM, (extentPt * mmPerPt) / MAX_CELLS_PER_AXIS);
  const cellPt = gridMm / mmPerPt;
  const cols = Math.ceil((region.maxX - region.minX) / cellPt) + 1;
  const rowsN = Math.ceil((region.maxY - region.minY) / cellPt) + 1;
  if (cols < 10 || rowsN < 10) return { rooms: [], unfilled: [] };

  // 0 = open, 1 = wall
  const grid = new Uint8Array(cols * rowsN);
  const stamp = (x: number, y: number) => {
    const cx = Math.floor((x - region.minX) / cellPt);
    const cy = Math.floor((y - region.minY) / cellPt);
    if (cx >= 0 && cx < cols && cy >= 0 && cy < rowsN) grid[cy * cols + cx] = 1;
  };
  const stampSegment = (s: Segment) => {
    const steps = Math.max(1, Math.ceil(s.len / (cellPt / 2)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      stamp(s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t);
    }
  };
  for (const s of segments) if (s.width >= penPt - 1e-6) stampSegment(s);
  for (const s of opts.bridges ?? []) stampSegment(s);

  // Morphological closing (dilate N, erode N) seals openings the bridges
  // missed without permanently thickening walls — sealed bridges survive
  // erosion, plain wall faces shrink back.
  const neighborPass = (source: Uint8Array, match: number, set: number): Uint8Array => {
    const out = new Uint8Array(source);
    for (let y = 0; y < rowsN; y++) {
      for (let x = 0; x < cols; x++) {
        if (source[y * cols + x] !== match) continue;
        let flip = false;
        for (let dy = -1; dy <= 1 && !flip; dy++) {
          for (let dx = -1; dx <= 1 && !flip; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rowsN && source[ny * cols + nx] !== match) flip = true;
          }
        }
        if (flip) out[y * cols + x] = set;
      }
    }
    return out;
  };
  let dilatedMask: Uint8Array | null = null;
  const dilated = (): Uint8Array => {
    if (dilatedMask) return dilatedMask;
    let d = new Uint8Array(grid);
    const passes = Math.ceil(CLOSING_REACH_MM / gridMm);
    for (let pass = 0; pass < passes; pass++) d = neighborPass(d, 0, 1);
    for (let pass = 0; pass < passes; pass++) d = neighborPass(d, 1, 0);
    for (let i = 0; i < grid.length; i++) if (grid[i]) d[i] = 1;
    dilatedMask = d;
    return d;
  };

  const inRegion = (t: TextRun): boolean => t.x >= region.minX && t.x <= region.maxX && t.y >= region.minY && t.y <= region.maxY;
  // known room words seed first so they win the naming race for their room
  const labels = texts
    .filter((t) => inRegion(t) && isRoomLabel(t))
    .sort((a, b) => Number(ROOM_WORDS.test(b.str)) - Number(ROOM_WORDS.test(a.str)) || b.str.length - a.str.length);

  const cellAreaM2 = (gridMm / 1000) ** 2;
  const maxCells = Math.ceil(MAX_ROOM_M2 / cellAreaM2);

  const floodFrom = (wallMask: Uint8Array, startIdx: number): { cells: number[]; leaked: boolean; boundary: number; filled: Uint8Array } => {
    const filled = new Uint8Array(cols * rowsN);
    const stack = [startIdx];
    const cells: number[] = [];
    filled[startIdx] = 1;
    let leaked = false;
    let boundary = 0;
    while (stack.length) {
      const idx = stack.pop()!;
      cells.push(idx);
      if (cells.length > maxCells) {
        leaked = true;
        break;
      }
      const x = idx % cols;
      const y = Math.floor(idx / cols);
      if (x === 0 || x === cols - 1 || y === 0 || y === rowsN - 1) leaked = true; // reached region edge: unbounded
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rowsN) continue;
        const nIdx = ny * cols + nx;
        if (wallMask[nIdx]) {
          boundary++;
          continue;
        }
        if (filled[nIdx]) continue;
        filled[nIdx] = 1;
        stack.push(nIdx);
      }
    }
    return { cells, leaked, boundary, filled };
  };

  const rooms: RoomArea[] = [];
  const unfilled: string[] = [];
  const claimed = new Uint8Array(cols * rowsN);
  // every label's seed cell up front: a fill that reaches another label's
  // seed has poured through an opening into the next room
  const seeds = labels.map((label) => {
    const sx = Math.floor((label.x + label.w / 2 - region.minX) / cellPt);
    const sy = Math.floor((label.y - region.minY) / cellPt);
    if (sx < 0 || sx >= cols || sy < 0 || sy >= rowsN) return -1;
    // a label whose anchor sits on a line still names the room next to it
    for (const [dx, dy] of [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0], [0, 2], [0, -2]] as const) {
      const cx = sx + dx;
      const cy = sy + dy;
      if (cx < 0 || cx >= cols || cy < 0 || cy >= rowsN) continue;
      if (!grid[cy * cols + cx]) return cy * cols + cx;
    }
    return -1;
  });
  const swallowsAnother = (filled: Uint8Array, own: number) => seeds.some((s) => s >= 0 && s !== own && filled[s] === 1);

  labels.forEach((label, index) => {
    const startIdx = seeds[index]!;
    if (startIdx < 0) {
      unfilled.push(label.str);
      return;
    }
    if (claimed[startIdx]) return;

    // Fill on the raw walls first — with openings bridged most rooms are
    // sealed there, and a closing applied up front floods narrow rooms shut.
    // Only when the raw fill leaks, or runs into another room's label, do we
    // retry on the closed grid.
    let { cells, leaked, boundary, filled } = floodFrom(grid, startIdx);
    let sealed = false;
    if ((leaked || swallowsAnother(filled, startIdx)) && !dilated()[startIdx]) {
      ({ cells, leaked, boundary, filled } = floodFrom(dilated(), startIdx));
      sealed = true;
    }
    if (leaked || swallowsAnother(filled, startIdx)) {
      unfilled.push(label.str);
      return;
    }

    // The wall line lands somewhere inside its cell, so on average the room
    // loses half a cell along every wall: give it back per boundary edge. A
    // room closed by the morphological seal has a boundary the closing drew,
    // so it gets no such credit.
    const areaM2 = Math.round((cells.length + (sealed ? 0 : boundary / 2)) * cellAreaM2 * 100) / 100;
    if (areaM2 < MIN_ROOM_M2 || areaM2 > MAX_ROOM_M2) {
      unfilled.push(label.str);
      return;
    }
    for (const c of cells) claimed[c] = 1;
    rooms.push({ name: label.str, areaM2, seed: [label.x, label.y], sealed });
  });
  return { rooms, unfilled };
}

export function measureRoomAreas(segments: Segment[], texts: TextRun[], region: DrawingRegion, mmPerPt: number, opts: RoomOptions = {}): RoomArea[] {
  return measureRooms(segments, texts, region, mmPerPt, opts).rooms;
}

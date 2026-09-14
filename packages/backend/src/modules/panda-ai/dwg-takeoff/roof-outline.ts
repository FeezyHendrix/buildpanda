import { traceCells } from "../pdf-takeoff/cell-outline.ts";
import type { DwgDoc, DwgEntity } from "./dwg.ts";
import { elementOf } from "./taxonomy.ts";
import type { LayerMap, RegisterSheet, UnitsDecision } from "./types.ts";

// A roof is rarely one shape on the drawing: a hipped roof is drawn as its
// slope panels, a complex roof as a panel per wing. Their union is the roof,
// so the panels are filled into a grid and the filled area is measured and
// traced. One closed outline still works — it is a union of one.

const MAX_CELLS_PER_AXIS = 1500;
const MIN_CELL_MM = 50;
const MIN_PANEL_M2 = 2;

export interface RoofArea {
  /** The union's outline in drawing units, and the area it encloses. */
  outline: number[][];
  areaM2: number;
  perimeterM: number;
  panels: number;
  /**
   * Is this point under the roof? The filled grid answers where the panels
   * themselves cannot: slope panels are drawn edge to edge, and the hairline
   * gaps between them would read as holes in a polygon test.
   */
  covers: (point: number[]) => boolean;
}

function bbox(points: number[][]) {
  const xs = points.map((p) => p[0]!);
  const ys = points.map((p) => p[1]!);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function polygonAreaUnits(points: number[][]): number {
  let doubled = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[(i + 1) % points.length]!;
    doubled += x1! * y2! - x2! * y1!;
  }
  return Math.abs(doubled / 2);
}

/** Closed polygons that make up the roof: the roof layer's, else any large one. */
export function roofPanels(doc: DwgDoc, sheet: RegisterSheet, map: LayerMap, units: UnitsDecision): number[][][] {
  const minUnits = (MIN_PANEL_M2 * 1e6) / (units.scaleToMm * units.scaleToMm);
  const onRoof: number[][][] = [];
  const anywhere: number[][][] = [];
  for (const index of sheet.members) {
    const e = doc.entities[index] as DwgEntity | undefined;
    if (!e || (e.entity !== "LWPOLYLINE" && e.entity !== "POLYLINE_2D")) continue;
    const pts = e.points;
    if (!pts || pts.length < 3) continue;
    const points = pts.map((p) => [p[0]!, p[1]!]);
    if (polygonAreaUnits(points) < minUnits) continue;
    if (elementOf(doc, e, map) === "roof") onRoof.push(points);
    else anywhere.push(points);
  }
  if (onRoof.length) return onRoof;
  // no roof layer: the largest closed shape on the sheet is the roof's edge
  const largest = anywhere.sort((a, b) => polygonAreaUnits(b) - polygonAreaUnits(a))[0];
  return largest ? [largest] : [];
}

function fill(points: number[][], grid: { minX: number; minY: number; cell: number; cols: number; rows: number }, cells: Uint8Array): void {
  const box = bbox(points);
  const y0 = Math.max(0, Math.floor((box.minY - grid.minY) / grid.cell));
  const y1 = Math.min(grid.rows - 1, Math.ceil((box.maxY - grid.minY) / grid.cell));
  for (let gy = y0; gy <= y1; gy++) {
    const y = grid.minY + (gy + 0.5) * grid.cell;
    // every crossing of this scan line, so a concave panel fills correctly
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1v] = points[i]!;
      const [x2, y2v] = points[(i + 1) % points.length]!;
      if (y1v! === y2v!) continue;
      if (y < Math.min(y1v!, y2v!) || y >= Math.max(y1v!, y2v!)) continue;
      xs.push(x1! + ((y - y1v!) / (y2v! - y1v!)) * (x2! - x1!));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.floor((xs[k]! - grid.minX) / grid.cell));
      const to = Math.min(grid.cols - 1, Math.ceil((xs[k + 1]! - grid.minX) / grid.cell));
      for (let gx = from; gx <= to; gx++) cells[gy * grid.cols + gx] = 1;
    }
  }
}

/** The roof the panels cover between them: its area, its edge and its perimeter. */
export function roofArea(panels: number[][][], units: UnitsDecision): RoofArea | null {
  if (!panels.length) return null;
  const all = panels.flat();
  const box = bbox(all);
  const span = Math.max(box.maxX - box.minX, box.maxY - box.minY);
  if (span <= 0) return null;
  const cell = Math.max(MIN_CELL_MM / units.scaleToMm, span / MAX_CELLS_PER_AXIS);
  const grid = {
    minX: box.minX - cell,
    minY: box.minY - cell,
    cell,
    cols: Math.ceil((box.maxX - box.minX) / cell) + 3,
    rows: Math.ceil((box.maxY - box.minY) / cell) + 3,
  };
  const cells = new Uint8Array(grid.cols * grid.rows);
  for (const panel of panels) fill(panel, grid, cells);
  let filled = 0;
  for (const c of cells) filled += c;
  if (!filled) return null;
  const toM = units.scaleToMm / 1000;
  const cellM = cell * toM;
  const outline = traceCells(cells, grid.cols, grid.rows, (gx, gy) => [grid.minX + gx * cell, grid.minY + gy * cell]);
  let perimeter = 0;
  for (let i = 0; i < outline.length; i++) {
    const [x1, y1] = outline[i]!;
    const [x2, y2] = outline[(i + 1) % outline.length]!;
    perimeter += Math.hypot(x2! - x1!, y2! - y1!) * toM;
  }
  const covers = (point: number[]): boolean => {
    const gx = Math.floor((point[0]! - grid.minX) / cell);
    const gy = Math.floor((point[1]! - grid.minY) / cell);
    if (gx < 0 || gy < 0 || gx >= grid.cols || gy >= grid.rows) return false;
    return cells[gy * grid.cols + gx] === 1;
  };
  return {
    covers,
    outline: outline.length >= 3 ? outline : all,
    areaM2: Math.round(filled * cellM * cellM * 100) / 100,
    perimeterM: Math.round(perimeter * 100) / 100,
    panels: panels.length,
  };
}

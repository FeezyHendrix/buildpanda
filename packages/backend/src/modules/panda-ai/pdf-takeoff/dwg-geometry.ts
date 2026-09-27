import { generateId } from "../../../lib/ids.ts";
import { polygonArea } from "./room-at.ts";
import type { DwgTakeoffShape, PreconGeometryRow } from "./types.ts";

// A DWG line's shapes become geometry rows on its sheet, the same objects a
// PDF run and a hand-drawn line write. The vertices are the drawing's own
// coordinates — the sheet's bounds are the viewer's viewBox, so no transform
// is needed — and the figure recorded beside each shape is the shape's own
// measurement, not the line's: a wall run is metres of centreline even though
// the line it belongs to is priced in square metres.

const round2 = (n: number) => Math.round(n * 100) / 100;

function polylineLength(vertices: number[][]): number {
  let total = 0;
  for (let i = 1; i < vertices.length; i++) {
    const a = vertices[i - 1]!;
    const b = vertices[i]!;
    total += Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
  }
  return total;
}

/** The shape's own base figure, in metres, or null when the scale is unknown. */
export function shapeFigure(shape: DwgTakeoffShape, scaleToMm: number): { quantity: number | null; unit: string | null } {
  if (shape.kind === "count") return { quantity: shape.vertices.length, unit: "nr" };
  if (!(scaleToMm > 0)) return { quantity: null, unit: null };
  const toM = scaleToMm / 1000;
  if (shape.kind === "linear") return { quantity: round2(polylineLength(shape.vertices) * toM), unit: "m" };
  return { quantity: round2(polygonArea(shape.vertices) * toM * toM), unit: "m2" };
}

/** One geometry row per shape of a DWG take-off line, drawn on the sheet it was measured on. */
export function dwgGeometryRows(
  rowId: string,
  sheetId: string,
  shapes: DwgTakeoffShape[] | undefined,
  scaleToMm: number,
): Omit<PreconGeometryRow, "created_at">[] {
  return (shapes ?? [])
    .filter((s) => s.vertices.length > 0)
    .map((shape) => {
      const { quantity, unit } = shapeFigure(shape, scaleToMm);
      return {
        id: generateId("pgeo"),
        row_id: rowId,
        sheet_id: sheetId,
        kind: shape.kind,
        vertices: shape.vertices,
        source: "ai" as const,
        quantity,
        unit,
      };
    });
}

import { xRange } from "./extent.ts";
import type { BlockDef, Insert, Primitive, Sheet } from "./types.ts";

// A handed plan: the geometry lives in a block that is inserted with a
// negative x scale. A symmetrical block of flats is one flat drawn once and
// inserted twice, the second time mirrored about the party wall; any other
// plan is drawn once and the whole thing mirrored, the way a "type B"
// handed unit is issued. Text and dimensions stay in model space, unmirrored,
// because nobody mirrors text.

export type MirrorMode = "flats" | "whole";

// Text sits at its left anchor, so its mirror moves by its own width.
const textWidth = (text: string, height: number) => text.length * height * 0.6;

function mirrorAnnotation(p: Primitive, w: number): Primitive {
  if (p.kind === "text") return { ...p, x: w - p.x - textWidth(p.text, p.height) };
  if (p.kind === "dimension") {
    const vertical = p.x1 === p.x2;
    return { ...p, x1: w - p.x1, x2: w - p.x2, offset: vertical ? -p.offset : p.offset };
  }
  return p;
}

const isAnnotation = (p: Primitive) => p.kind === "text" || p.kind === "dimension";

/**
 * Rewrites a plan sheet in place: geometry into `block`, replaced by inserts.
 * Returns the block when this sheet defined it (the first sheet does; later
 * identical floors reuse it and get no block of their own).
 */
export function mirrorSheet(sheet: Sheet, widthMm: number, mode: MirrorMode, blockName: string, existing: BlockDef | null): BlockDef | null {
  const mid = widthMm / 2;
  const kept: Primitive[] = [];
  const members: Primitive[] = [];
  for (const p of sheet.primitives) {
    if (isAnnotation(p)) {
      kept.push(mode === "whole" ? mirrorAnnotation(p, widthMm) : p);
      continue;
    }
    if (mode === "whole") {
      members.push(p);
      continue;
    }
    const [lo, hi] = xRange(p);
    if (hi <= mid + 1e-6) members.push(p);
    else if (lo >= mid - 1e-6) continue; // the mirror draws it
    else kept.push(p); // straddles the party wall: columns on the grid line, the overall dimension
  }
  const inserts: Insert[] =
    mode === "whole"
      ? [{ kind: "insert", id: `${sheet.id}_mir`, layer: "zero", block: blockName, x: widthMm, y: 0, rotationDeg: 0, scaleX: -1 }]
      : [
          { kind: "insert", id: `${sheet.id}_flat_a`, layer: "zero", block: blockName, x: 0, y: 0, rotationDeg: 0 },
          { kind: "insert", id: `${sheet.id}_flat_b`, layer: "zero", block: blockName, x: widthMm, y: 0, rotationDeg: 0, scaleX: -1 },
        ];
  sheet.primitives = [...inserts, ...kept];
  if (existing) return null;
  return { name: blockName, primitives: members };
}

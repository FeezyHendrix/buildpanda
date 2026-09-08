import { BLOCK_OPENINGS, INLINE_OPENINGS, type OpeningStyleHooks } from "./plan.ts";
import { buildFamily } from "./families.ts";
import type { BlockDef, Convention, Drawing, Family, LayerRole, Primitive, Sheet, Text, Truth } from "./types.ts";

// The convention matrix: the same building drawn the different ways real
// offices draw it. The engine has to cope with all of them; the truth is the
// same regardless.

export const CONVENTIONS: Convention[] = [
  { id: "named-mm-blocks-dims", layers: "named", openings: "blocks", dimensions: "dimensions", units: "mm" },
  { id: "named-mm-outlines-dims", layers: "named", openings: "outlines", dimensions: "dimensions", units: "mm" },
  { id: "badnames-mm-outlines-dims", layers: "badnames", openings: "outlines", dimensions: "dimensions", units: "mm" },
  { id: "layer0-mm-outlines-dims", layers: "layer0", openings: "outlines", dimensions: "dimensions", units: "mm" },
  { id: "named-m-outlines-dims", layers: "named", openings: "outlines", dimensions: "dimensions", units: "m" },
  { id: "named-mm-outlines-exploded", layers: "named", openings: "outlines", dimensions: "exploded", units: "mm" },
  { id: "named-mm-outlines-scale", layers: "named", openings: "outlines", dimensions: "written-scale", units: "mm" },
];

const LAYER_NAMES: Record<Convention["layers"], Record<LayerRole, string>> = {
  named: { wall: "WALL", door: "DOOR", window: "WIND", column: "COLUMN", sanitary: "SANITARY", dim: "DIM", text: "TEXT", grid: "Grid", furniture: "FURNITURE", roof: "ROOF", step: "STEP", zero: "0" },
  badnames: { wall: "A-WALL-FULL", door: "A-DOOR", window: "A-GLAZ", column: "S-COLS", sanitary: "P-FIXT", dim: "A-ANNO-DIMS", text: "A-ANNO-TEXT", grid: "S-GRID", furniture: "I-FURN", roof: "A-ROOF", step: "A-FLOR-STRS", zero: "0" },
  layer0: { wall: "0", door: "0", window: "0", column: "0", sanitary: "0", dim: "0", text: "0", grid: "0", furniture: "0", roof: "0", step: "0", zero: "0" },
};

export function layerNameFor(convention: Convention, role: LayerRole): string {
  return LAYER_NAMES[convention.layers][role];
}

// Blocks referenced by the "blocks" opening style; drawn once in mm at the origin.
export const BLOCKS: BlockDef[] = [
  {
    name: "DOOR-900",
    primitives: [
      { kind: "arc", id: "b_door_arc", layer: "door", cx: -450, cy: 0, r: 900, startDeg: 0, endDeg: 90 },
      { kind: "line", id: "b_door_leaf", layer: "door", x1: -450, y1: 0, x2: -450, y2: 900 },
    ],
  },
  {
    name: "WIN-1200",
    primitives: [{ kind: "polyline", id: "b_win", layer: "window", closed: true, points: [[-600, -60], [600, -60], [600, 60], [-600, 60]] }],
  },
  {
    name: "WC-STD",
    primitives: [{ kind: "polyline", id: "b_wc", layer: "sanitary", closed: true, points: [[-200, -300], [200, -300], [200, 300], [-200, 300]] }],
  },
];

function hooksFor(convention: Convention): OpeningStyleHooks {
  return convention.openings === "blocks" ? BLOCK_OPENINGS : INLINE_OPENINGS;
}

// Dimensions drawn the three ways they arrive: real entities, exploded to a
// line and a text, or absent with a written scale.
function applyDimensionStyle(sheet: Sheet, convention: Convention): void {
  if (convention.dimensions === "dimensions") return;
  const kept: Primitive[] = [];
  for (const p of sheet.primitives) {
    if (p.kind !== "dimension") {
      kept.push(p);
      continue;
    }
    if (convention.dimensions === "exploded") {
      const horizontal = p.y1 === p.y2;
      const lx1 = horizontal ? p.x1 : p.x1 + p.offset;
      const ly1 = horizontal ? p.y1 + p.offset : p.y1;
      const lx2 = horizontal ? p.x2 : p.x2 + p.offset;
      const ly2 = horizontal ? p.y2 + p.offset : p.y2;
      kept.push({ kind: "line", id: `${p.id}_ln`, layer: "dim", x1: lx1, y1: ly1, x2: lx2, y2: ly2 });
      const text: Text = {
        kind: "text",
        id: `${p.id}_tx`,
        layer: "dim",
        x: horizontal ? (lx1 + lx2) / 2 - 300 : lx1 + 120,
        y: horizontal ? ly1 + 120 : (ly1 + ly2) / 2,
        height: 200,
        text: String(p.value),
      };
      kept.push(text);
    }
  }
  if (convention.dimensions === "written-scale") {
    kept.push({ kind: "text", id: `${sheet.id}_scale`, layer: "text", x: 0, y: -4000, height: 300, text: "SCALE 1:100" });
  }
  sheet.primitives = kept;
}

export function buildDrawing(family: Family, convention: Convention): { drawing: Drawing; truth: Truth } {
  const built = buildFamily(family, hooksFor(convention));
  for (const sheet of built.sheets) applyDimensionStyle(sheet, convention);
  const drawing: Drawing = {
    family,
    convention,
    sheets: built.sheets,
    blocks: convention.openings === "blocks" ? BLOCKS : [],
    unitsPerMm: convention.units === "m" ? 0.001 : 1,
  };
  return { drawing, truth: { ...built.truth, convention } };
}

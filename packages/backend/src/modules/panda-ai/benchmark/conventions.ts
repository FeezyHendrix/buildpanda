import { TITLE_BLOCK, annotateSheet } from "./annotations.ts";
import { extentOf } from "./extent.ts";
import { buildFamily, type FamilyOptions } from "./families.ts";
import { feetInches } from "./imperial.ts";
import { mirrorSheet } from "./mirror.ts";
import { ATTRIB_OPENINGS, BLOCK_OPENINGS, INLINE_OPENINGS } from "./plan.ts";
import type { BlockDef, Convention, Drawing, Family, LayerRole, Primitive, Sheet, Text, Truth } from "./types.ts";

// The convention matrix: the same building drawn the different ways real
// offices draw it. The engine has to cope with all of them; the truth is the
// same regardless.

const base = { layers: "named", openings: "outlines", dimensions: "dimensions", units: "mm" } as const;

export const CONVENTIONS: Convention[] = [
  { id: "named-mm-blocks-dims", ...base, openings: "blocks" },
  { id: "named-mm-outlines-dims", ...base },
  { id: "badnames-mm-outlines-dims", ...base, layers: "badnames" },
  { id: "layer0-mm-outlines-dims", ...base, layers: "layer0" },
  { id: "named-m-outlines-dims", ...base, units: "m" },
  { id: "named-mm-outlines-exploded", ...base, dimensions: "exploded" },
  { id: "named-mm-outlines-scale", ...base, dimensions: "written-scale" },
  // the hard set: each one a habit seen on real drawings
  { id: "named-mm-outlines-unjambed", ...base, walls: "unjambed" },
  { id: "named-mm-outlines-split", ...base, walls: "split" },
  { id: "named-mm-outlines-mirrored", ...base, mirror: true },
  { id: "named-mm-outlines-hatched", ...base, walls: "hatched" },
  { id: "named-mm-outlines-hatchexploded", ...base, walls: "hatched-exploded" },
  { id: "named-in-outlines-imperial", ...base, units: "in", dimensions: "imperial" },
  { id: "named-mm-outlines-titleblock", ...base, annotations: true },
  { id: "named-mm-outlines-singlepen", ...base, pdf: "single-pen" },
  { id: "named-mm-outlines-lshape", ...base, shape: "l-shape" },
  { id: "named-mm-attribs-schedule", ...base, openings: "attrib-blocks" },
  // the plan is a scan placed on a CAD sheet: pixels inside a vector title block
  { id: "named-mm-outlines-raster", ...base, pdf: "raster", annotations: true },
];

const LAYER_NAMES: Record<Convention["layers"], Record<LayerRole, string>> = {
  named: { wall: "WALL", door: "DOOR", window: "WIND", column: "COLUMN", sanitary: "SANITARY", dim: "DIM", text: "TEXT", grid: "Grid", furniture: "FURNITURE", roof: "ROOF", step: "STEP", hatch: "HATCH", zero: "0" },
  badnames: { wall: "A-WALL-FULL", door: "A-DOOR", window: "A-GLAZ", column: "S-COLS", sanitary: "P-FIXT", dim: "A-ANNO-DIMS", text: "A-ANNO-TEXT", grid: "S-GRID", furniture: "I-FURN", roof: "A-ROOF", step: "A-FLOR-STRS", hatch: "A-WALL-PATT", zero: "0" },
  layer0: { wall: "0", door: "0", window: "0", column: "0", sanitary: "0", dim: "0", text: "0", grid: "0", furniture: "0", roof: "0", step: "0", hatch: "0", zero: "0" },
};

export function layerNameFor(convention: Convention, role: LayerRole): string {
  return LAYER_NAMES[convention.layers][role];
}

// Blocks referenced by the block opening styles; drawn once in mm at the origin.
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

// The attribute convention uses a 1,000 mm door and a 1,500 mm window, so the
// sizes the attributes state differ from the defaults an engine might assume.
export const ATTRIB_DOOR_MM = 1000;
export const ATTRIB_WINDOW_MM = 1500;
export const ATTRIB_BLOCKS: BlockDef[] = [
  {
    name: "DOOR",
    primitives: [
      { kind: "arc", id: "b_door_arc", layer: "door", cx: -500, cy: 0, r: 1000, startDeg: 0, endDeg: 90 },
      { kind: "line", id: "b_door_leaf", layer: "door", x1: -500, y1: 0, x2: -500, y2: 1000 },
    ],
  },
  {
    name: "WINDOW",
    primitives: [{ kind: "polyline", id: "b_win", layer: "window", closed: true, points: [[-750, -60], [750, -60], [750, 60], [-750, 60]] }],
  },
  BLOCKS[2]!,
];

function familyOptions(convention: Convention): FamilyOptions {
  const hooks = convention.openings === "blocks" ? BLOCK_OPENINGS : convention.openings === "attrib-blocks" ? ATTRIB_OPENINGS : INLINE_OPENINGS;
  const attribs = convention.openings === "attrib-blocks";
  return {
    hooks,
    walls: convention.walls ?? "jambed",
    shape: convention.shape ?? "rect",
    doorMm: attribs ? ATTRIB_DOOR_MM : undefined,
    windowMm: attribs ? ATTRIB_WINDOW_MM : undefined,
    schedule: attribs,
  };
}

// A level mark or dimension typed the imperial way.
const LEVEL_TEXT = /^\+(\d+)(\s.*)?$/;

// Dimensions drawn the ways they arrive: real entities, exploded to a line
// and a text, absent with a written scale, or real entities reading feet and inches.
function applyDimensionStyle(sheet: Sheet, convention: Convention): void {
  if (convention.dimensions === "dimensions") return;
  const kept: Primitive[] = [];
  for (const p of sheet.primitives) {
    if (convention.dimensions === "imperial") {
      if (p.kind === "dimension") kept.push({ ...p, text: feetInches(p.value) });
      else if (p.kind === "text" && LEVEL_TEXT.test(p.text)) kept.push({ ...p, text: p.text.replace(LEVEL_TEXT, (_, mm: string, rest: string) => `+${feetInches(Number(mm))}${rest ?? ""}`) });
      else kept.push(p);
      continue;
    }
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
  if (convention.dimensions === "imperial") {
    kept.push({ kind: "text", id: `${sheet.id}_scale`, layer: "text", x: 0, y: -4000, height: 300, text: 'SCALE: 1/8" = 1\'-0"' });
  }
  sheet.primitives = kept;
}

export function buildDrawing(family: Family, convention: Convention): { drawing: Drawing; truth: Truth } {
  const built = buildFamily(family, familyOptions(convention));
  const blocks: BlockDef[] = convention.openings === "blocks" ? [...BLOCKS] : convention.openings === "attrib-blocks" ? [...ATTRIB_BLOCKS] : [];
  for (const sheet of built.sheets) applyDimensionStyle(sheet, convention);
  if (convention.mirror) {
    // a symmetrical block of flats is one flat inserted twice; anything else is the whole plan handed
    const mode = family === "block4" ? "flats" : "whole";
    const name = mode === "flats" ? "FLAT-TYPE-A" : `PLAN-${family.toUpperCase()}`;
    let block: BlockDef | null = null;
    for (const sheet of built.sheets) {
      if (sheet.kind !== "floor-plan") continue;
      // identical floors share one block; a different floor (a duplex's first floor) gets its own
      const own = mode === "flats" || !block ? block : null;
      const made = mirrorSheet(sheet, built.planWidthMm, mode, mode === "flats" ? name : `${name}-${sheet.id.toUpperCase()}`, own);
      if (made) {
        blocks.push(made);
        block ??= made;
      }
    }
  }
  if (convention.annotations) {
    blocks.push(TITLE_BLOCK);
    built.sheets.forEach((sheet, i) => annotateSheet(sheet, i));
    // framed sheets are wider than the bare drawings: lay them out again so no two borders overlap
    let x = 0;
    for (const sheet of built.sheets) {
      const ext = extentOf(sheet.primitives);
      sheet.originX = x - ext.minX;
      x += ext.maxX - ext.minX + 6000;
    }
  }
  const drawing: Drawing = {
    family,
    convention,
    sheets: built.sheets,
    blocks,
    unitsPerMm: convention.units === "m" ? 0.001 : convention.units === "in" ? 1 / 25.4 : 1,
  };
  return { drawing, truth: { ...built.truth, convention } };
}

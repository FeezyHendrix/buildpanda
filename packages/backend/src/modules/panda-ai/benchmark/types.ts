// The benchmark's own vocabulary: a parametric building becomes a set of
// drawings made of primitives in millimetres (y up), plus a truth manifest
// that records what those primitives represent. Writers turn the primitives
// into DXF/DWG and PDF; the harness compares engine output to the truth.

export const FAMILIES = ["bungalow", "duplex", "block4", "tower20"] as const;
export type Family = (typeof FAMILIES)[number];

export const LAYER_SCHEMES = ["named", "badnames", "layer0"] as const;
export type LayerScheme = (typeof LAYER_SCHEMES)[number];

// "attrib-blocks": doors and windows are blocks carrying MARK/WIDTH/SIZE
// attributes, with a schedule sheet listing the marks.
export const OPENING_STYLES = ["blocks", "outlines", "attrib-blocks"] as const;
export type OpeningStyle = (typeof OPENING_STYLES)[number];

// "imperial": real dimension entities whose text reads feet and inches.
export const DIMENSION_STYLES = ["dimensions", "exploded", "written-scale", "imperial"] as const;
export type DimensionStyle = (typeof DIMENSION_STYLES)[number];

export const UNIT_STYLES = ["mm", "m", "in"] as const;
export type UnitStyle = (typeof UNIT_STYLES)[number];

// How the wall faces are drawn: closed with jambs at every opening; left open
// at openings; broken into pieces with millimetre overlaps and gaps at the
// joints; filled with a HATCH entity; or filled with the short diagonal lines
// an exploded hatch leaves on the wall layer.
export const WALL_STYLES = ["jambed", "unjambed", "split", "hatched", "hatched-exploded"] as const;
export type WallStyle = (typeof WALL_STYLES)[number];

export const PLAN_SHAPES = ["rect", "l-shape"] as const;
export type PlanShape = (typeof PLAN_SHAPES)[number];

// How the PDF is exported: pens by layer, one pen for everything, or the plan
// as an embedded raster image with only the title block left as vectors.
export const PDF_STYLES = ["layered", "single-pen", "raster"] as const;
export type PdfStyle = (typeof PDF_STYLES)[number];

export interface Convention {
  id: string;
  layers: LayerScheme;
  openings: OpeningStyle;
  dimensions: DimensionStyle;
  units: UnitStyle;
  walls?: WallStyle;
  shape?: PlanShape;
  // the plan is a block inserted with a negative x scale (a handed flat)
  mirror?: boolean;
  // border, title block, scale bar, north arrow and a notes column on every sheet
  annotations?: boolean;
  pdf?: PdfStyle;
}

// Semantic layer roles; the convention maps them to actual layer names.
export type LayerRole =
  | "wall"
  | "door"
  | "window"
  | "column"
  | "sanitary"
  | "dim"
  | "text"
  | "grid"
  | "furniture"
  | "roof"
  | "step"
  | "hatch"
  | "zero";

export interface Line {
  kind: "line";
  id: string;
  layer: LayerRole;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  heavy?: boolean;
}
export interface Polyline {
  kind: "polyline";
  id: string;
  layer: LayerRole;
  points: number[][];
  closed: boolean;
  heavy?: boolean;
}
export interface Arc {
  kind: "arc";
  id: string;
  layer: LayerRole;
  cx: number;
  cy: number;
  r: number;
  startDeg: number;
  endDeg: number;
}
export interface Text {
  kind: "text";
  id: string;
  layer: LayerRole;
  x: number;
  y: number;
  height: number;
  text: string;
}
export interface Dimension {
  kind: "dimension";
  id: string;
  layer: LayerRole;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  // perpendicular offset of the dimension line from the measured points
  offset: number;
  value: number;
  // what the dimension reads when it is not the bare value (feet and inches)
  text?: string;
}
export interface Insert {
  kind: "insert";
  id: string;
  layer: LayerRole;
  block: string;
  x: number;
  y: number;
  rotationDeg: number;
  // -1 mirrors the block about its own y axis
  scaleX?: number;
  // ATTRIB values by tag, drawn as text beside the insertion point
  attributes?: Record<string, string>;
}
// A solid hatch over a closed polygon.
export interface Hatch {
  kind: "hatch";
  id: string;
  layer: LayerRole;
  points: number[][];
}
export type Primitive = Line | Polyline | Arc | Text | Dimension | Insert | Hatch;

export interface BlockDef {
  name: string;
  primitives: Primitive[];
}

export interface Sheet {
  id: string;
  kind: "floor-plan" | "elevation" | "section" | "roof-plan" | "site-plan" | "schedule";
  title: string;
  level: string | null;
  // origin offset in model space when several drawings share one model space
  originX: number;
  originY: number;
  primitives: Primitive[];
}

export interface Drawing {
  family: Family;
  convention: Convention;
  sheets: Sheet[];
  blocks: BlockDef[];
  // 1 for millimetre drawings, 0.001 for metre drawings
  unitsPerMm: number;
}

// ---------- truth ----------

export interface TruthRoom {
  name: string;
  areaM2: number;
  perimeterM: number;
  sheet: string;
}

export type TruthElementKind =
  | "walls-external"
  | "walls-internal"
  | "columns"
  | "doors"
  | "windows"
  | "sanitary"
  | "floor-area";

export interface TruthElement {
  element: TruthElementKind;
  sheet: string;
  count?: number;
  lengthM?: number;
  areaM2?: number;
  thicknessMm?: number;
  heightM?: number;
  // ids of the primitives that constitute the quantity, for provenance checks
  ids: string[];
}

export interface TruthSheet {
  id: string;
  kind: Sheet["kind"];
  title: string;
  level: string | null;
  repeats: number;
}

export interface Truth {
  family: Family;
  convention: Convention;
  storeys: number;
  storeyHeightM: number;
  sheets: TruthSheet[];
  rooms: TruthRoom[];
  elements: TruthElement[];
  // building totals after repeats (typical floors multiplied)
  building: {
    floorAreaM2: number;
    columns: number;
    doors: number;
    windows: number;
    wallsExternalM2: number;
    wallsInternalM2: number;
  };
}

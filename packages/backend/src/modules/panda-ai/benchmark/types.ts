// The benchmark's own vocabulary: a parametric building becomes a set of
// drawings made of primitives in millimetres (y up), plus a truth manifest
// that records what those primitives represent. Writers turn the primitives
// into DXF/DWG and PDF; the harness compares engine output to the truth.

export const FAMILIES = ["bungalow", "duplex", "block4", "tower20"] as const;
export type Family = (typeof FAMILIES)[number];

export const LAYER_SCHEMES = ["named", "badnames", "layer0"] as const;
export type LayerScheme = (typeof LAYER_SCHEMES)[number];

export const OPENING_STYLES = ["blocks", "outlines"] as const;
export type OpeningStyle = (typeof OPENING_STYLES)[number];

export const DIMENSION_STYLES = ["dimensions", "exploded", "written-scale"] as const;
export type DimensionStyle = (typeof DIMENSION_STYLES)[number];

export const UNIT_STYLES = ["mm", "m"] as const;
export type UnitStyle = (typeof UNIT_STYLES)[number];

export interface Convention {
  id: string;
  layers: LayerScheme;
  openings: OpeningStyle;
  dimensions: DimensionStyle;
  units: UnitStyle;
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
}
export interface Insert {
  kind: "insert";
  id: string;
  layer: LayerRole;
  block: string;
  x: number;
  y: number;
  rotationDeg: number;
}
export type Primitive = Line | Polyline | Arc | Text | Dimension | Insert;

export interface BlockDef {
  name: string;
  primitives: Primitive[];
}

export interface Sheet {
  id: string;
  kind: "floor-plan" | "elevation" | "section" | "roof-plan" | "site-plan";
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

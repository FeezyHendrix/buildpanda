// One normalised drawing document for both parsers. Measurement code should
// read this, never the raw DWG JSON or the PDF operator list, so a rule written
// once applies to a DWG and a PDF alike. Ids are stable handles (DWG handle,
// PDF op index) so every quantity can cite the entities it came from.

export interface GeoText {
  id: string;
  text: string;
  x: number;
  y: number;
  height: number | null;
  layer: string | null;
  kind: "text" | "mtext" | "dimension" | "attrib";
}

export interface GeoSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  layer: string | null;
  width: number | null;
  color: number | null;
  fill: boolean;
  source?: string;
}

export interface GeoClosedShape {
  id: string;
  points: number[][];
  layer: string | null;
  fill: boolean;
  kind: "polyline" | "hatch" | "circle";
}

export interface GeoArc {
  id: string;
  cx: number;
  cy: number;
  r: number;
  startAngle: number;
  endAngle: number;
  layer: string | null;
}

export interface GeoInsert {
  id: string;
  blockName: string;
  x: number;
  y: number;
  scale: [number, number];
  rotation: number;
  layer: string | null;
  attributes: Record<string, string>;
}

export interface GeoDimension {
  id: string;
  value: number;
  textOverride: string | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  layer: string | null;
}

export const GEO_UNITS = ["mm", "cm", "m", "in", "ft", "unknown"] as const;
export type GeoUnit = (typeof GEO_UNITS)[number];

export const UNIT_BASES = ["header", "dimensions", "text", "assumed"] as const;
export type UnitBasis = (typeof UNIT_BASES)[number];

export interface GeoUnits {
  unit: GeoUnit;
  basis: UnitBasis;
  confidence: number;
  note: string;
}

export interface GeoLayer {
  name: string;
  count: number;
  color: number | null;
}

export interface GeoBlock {
  name: string;
  inserts: number;
  entities: number;
}

export interface GeoUnreadable {
  what: string;
  count: number;
  note: string;
}

export interface GeoDocument {
  source: "dwg" | "pdf";
  units: GeoUnits;
  space: "model" | "page";
  layers: GeoLayer[];
  blocks: GeoBlock[];
  segments: GeoSegment[];
  shapes: GeoClosedShape[];
  arcs: GeoArc[];
  inserts: GeoInsert[];
  texts: GeoText[];
  dimensions: GeoDimension[];
  unreadable: GeoUnreadable[];
}

// ---------- extraction report ----------

// What a layer would be treated as by the measuring rules that exist today.
// "ignored" is the honest answer for everything the engines never read.
export const LAYER_ELEMENTS = [
  "walls",
  "columns",
  "doors",
  "windows",
  "sanitary",
  "stairs",
  "roof",
  "furniture",
  "dimensions",
  "text",
  "grid",
  "ignored",
] as const;
export type LayerElement = (typeof LAYER_ELEMENTS)[number];

export interface ExtractionLayerRow {
  name: string;
  count: number;
  color: number | null;
  element: LayerElement;
  byType: Record<string, number>;
}

export interface ExtractionTotals {
  segments: number;
  shapes: number;
  arcs: number;
  inserts: number;
  texts: number;
  dimensions: number;
  all: number;
}

export interface ExtractionDimensions {
  count: number;
  min: number | null;
  median: number | null;
  max: number | null;
}

export interface ExtractionCoverage {
  // share of geometry (segments + shapes + arcs + inserts) on layers a rule would consume
  measuredShare: number;
  measuredLayers: string[];
  ignoredLayers: string[];
}

export interface ExtractionReport {
  source: "dwg" | "pdf";
  units: GeoUnits;
  totals: ExtractionTotals;
  layers: ExtractionLayerRow[];
  blocks: GeoBlock[];
  dimensions: ExtractionDimensions;
  texts: { text: string; count: number }[];
  unreadable: GeoUnreadable[];
  coverage: ExtractionCoverage;
  extents: { width: number; height: number } | null;
  warnings: string[];
}

// A compact per-sheet cut of the report, small enough to sit on every sheet row.
export interface GeoSummary {
  source: "dwg" | "pdf";
  units: GeoUnits;
  totals: ExtractionTotals;
  coverage: ExtractionCoverage;
  topLayers: { name: string; count: number; element: LayerElement }[];
  dimensions: ExtractionDimensions;
  unreadable: number;
  warnings: string[];
}

// The session-level record: one report per sheet id.
export interface SessionExtraction {
  sheets: Record<string, ExtractionReport>;
  generatedAt: string;
}

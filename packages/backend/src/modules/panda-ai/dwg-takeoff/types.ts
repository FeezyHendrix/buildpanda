export const TAKEOFF_STATUSES = ["pending", "processing", "completed", "failed"] as const;
export type TakeoffStatus = (typeof TAKEOFF_STATUSES)[number];

// What a layer holds. Proposed from names and contents, corrected by the
// reviewer, remembered on the session as the layer map.
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
  "levels",
  "ignore",
  "auto",
] as const;
export type LayerElement = (typeof LAYER_ELEMENTS)[number];
export type LayerMap = Record<string, LayerElement>;

export const DRAWING_UNITS = ["mm", "cm", "m", "in", "ft", "unknown"] as const;
export type DrawingUnit = (typeof DRAWING_UNITS)[number];

export interface UnitsDecision {
  unit: DrawingUnit;
  // multiply a drawing-unit length by this to get millimetres
  scaleToMm: number;
  basis: "header" | "dimensions" | "cross-check" | "assumed";
  // estimated relative error of a measured length, as a fraction (0.05 = ±5 %)
  errorPct: number;
  samples: number;
  note: string;
}

export interface DrawingSummary {
  id: number;
  kind: string;
  widthM: number;
  heightM: number;
  entityCount: number;
}

// One drawing found in the model space: a sheet in the take-off.
export interface RegisterSheet {
  id: number;
  code: string;
  title: string;
  kind: "floor-plan" | "elevation" | "section" | "detail" | "unknown";
  // level mark on the drawing (e.g. +3450 → 3450 mm) and the floor name it carries
  levelMm: number | null;
  levelName: string | null;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  widthM: number;
  heightM: number;
  entityCount: number;
  // identical-drawing group: the representative is measured, the rest multiply it
  group: number;
  multiplier: number;
  representative: boolean;
  labels: string[];
  // indices into doc.entities of the geometry and text this sheet owns
  members: number[];
  textMembers: number[];
}

export interface MeasuredItem {
  trade: string;
  description: string;
  quantity: number;
  unit: string;
  confidence: "high" | "medium" | "low";
  basis: string;
  // which register sheet this line was measured on (the representative)
  sheetId?: number;
  // the object handles the quantity was computed from; the viewer can cite them
  evidence?: number[];
  // what the second method said, and whether it agreed
  crossCheck?: string;
  // short machine-readable reason behind the confidence
  reason?: string;
  // how many identical drawings this quantity already includes
  multiplier?: number;
  // evidence for another line, never a priced quantity of its own (an
  // elevation's window count, say); lands in the bill as a note
  noteOnly?: boolean;
}

export interface TakeoffResult {
  // kept for the job record and old readers; scaleToMm now comes from units
  scaleToMm: number;
  scaleConfidence: number;
  units?: UnitsDecision;
  sheets?: RegisterSheet[];
  layerMap?: LayerMap;
  drawings: DrawingSummary[];
  selectedDrawingId: number | null;
  items: MeasuredItem[];
  notes: string[];
  // one per measured plan: what the wall lines were computed from
  wallSummaries?: WallSummary[];
}

export interface WallSummary {
  sheetId: number;
  code: string;
  byThickness: Array<{ thicknessMm: number; lengthM: number }>;
  totalLengthM: number;
  runs: number;
  openings: { doors: number; windows: number; areaM2: number };
  height: { mm: number; basis: string; assumed: boolean };
  bridgedM: number;
  unpairedM: number;
  units: DrawingUnit;
  checks: { dimensions: string; roomPerimeters: string };
}

export interface TakeoffJobRow {
  id: string;
  project_id: string | null;
  proposal_id: string | null;
  file_id: string | null;
  status: TakeoffStatus;
  file_name: string;
  storage_path: string;
  result: TakeoffResult | string | null;
  drawing_count: number;
  element_count: number;
  error: string | null;
  requested_by: string | null;
  session_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface TakeoffJob {
  id: string;
  projectId: string | null;
  proposalId: string | null;
  fileId: string | null;
  status: TakeoffStatus;
  fileName: string;
  result: TakeoffResult | null;
  drawingCount: number;
  elementCount: number;
  error: string | null;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

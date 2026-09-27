// What the DWG engine hands the take-off session.
//
// Split out of `session-types.ts` at the house 400-line ceiling, and a clean
// seam: these describe the engine's OUTPUT, not the session record, and only
// the DWG path and its re-run ever name them. `types.ts` re-exports them, so no
// importer had to move.

import type { DwgTakeoffShape, SheetBounds } from "./geometry-types.ts";
import type { SessionLayerMap } from "./session-types.ts";

// Rows a DWG take-off hands over; the session stores them like any AI draft.
export interface DwgTakeoffLine {
  trade: string;
  description: string;
  quantity: number;
  unit: string;
  confidence: "high" | "medium" | "low";
  basis: string;
  // the register sheet the line was measured on, and what checked it
  sheetId?: number;
  evidence?: number[];
  shapes?: DwgTakeoffShape[];
  reason?: string;
  crossCheck?: string;
  // evidence for another line (an elevation's window count); lands as an unpriced note
  noteOnly?: boolean;
}

// One drawing of the DWG register, as the engine hands it to the session.
export interface DwgRegisterSheet {
  id: number;
  code: string;
  title: string;
  kind: string;
  bounds: SheetBounds;
  levelMm: number | null;
  multiplier: number;
}

// Everything the DWG engine hands the session: units, register, layer map, lines, notes.
export interface DwgTakeoffHandover {
  units: { unit: string; scaleToMm: number; errorPct: number; note: string };
  layerMap: SessionLayerMap;
  sheets: DwgRegisterSheet[];
  items: DwgTakeoffLine[];
  notes: string[];
}

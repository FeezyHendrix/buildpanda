// Request bodies and results for the batch restructures: split, trim, polygon
// split, transform, duplicate, merge and reassign.
//
// Split out of request-types.ts at the house 400-line ceiling. Re-exported by
// types.ts, so every existing `./types.ts` import keeps resolving.

import type { ExpectedVersion } from "./request-types.ts";
import type { PreconBoqRowDto } from "./row-types.ts";

export interface SplitPolylineBody {
  version: number;
  /** The vertex the run is cut at; never the first or the last, which cut nothing. */
  splitAtIndex: number;
  operationId?: string;
}

export interface SplitPolylineResult {
  original: PreconBoqRowDto;
  pieces: [string, string];
  createdGeometryIds: string[];
}

export interface RemoveSegmentBody {
  version: number;
  operationId?: string;
}

/** A cut in the middle leaves two runs, so the result names what it created. */
export interface RemoveSegmentResult {
  row: PreconBoqRowDto;
  createdGeometryIds: string[];
}

export interface SplitPolygonBody {
  version: number;
  geometryId: string;
  /** Two points defining the straight cut, in sheet coordinates. */
  cut: [[number, number], [number, number]];
  operationId?: string;
}

export interface SplitPolygonResult {
  row: PreconBoqRowDto;
  createdGeometryIds: string[];
}

export interface TransformGeometryBody {
  version: number;
  geometryId: string;
  translate?: [number, number];
  rotateDeg?: number;
  about?: [number, number];
  operationId?: string;
}

/** How a copy onto another drawing is reconciled when the scales differ. */
export const CROSS_SHEET_MODES = ["preserve-real-size", "retrace"] as const;
export type CrossSheetMode = (typeof CROSS_SHEET_MODES)[number];

export interface DuplicateGeometryBody {
  version: number;
  operationId?: string;
  geometryId?: string;
  /** Where the copy lands, in sheet points. */
  offset?: [number, number];
  targetSheetId?: string;
  crossSheet?: CrossSheetMode;
}

export interface DuplicateGeometryResult {
  newRow: PreconBoqRowDto;
  newGeometryId: string;
}

/** Copying a whole line: every drawing it carries, and every void in them. */
export interface DuplicateRowBody {
  version: number;
  operationId?: string;
  offset?: [number, number];
  targetSheetId?: string;
  crossSheet?: CrossSheetMode;
}

export interface DuplicateRowResult {
  newRow: PreconBoqRowDto;
  newRowId: string;
  createdGeometryIds: string[];
}

/**
 * A merge and a reassignment restate lines the caller may not have open, so both
 * may name every row and sheet they touch with the version the client held. An
 * empty list means the operation envelope has already checked them.
 */
export interface MergeGeometriesBody {
  rowIds: string[];
  operationId?: string;
  expectedRows?: ExpectedVersion[];
  expectedSheets?: ExpectedVersion[];
}

export interface MergeGeometriesResult {
  keptRow: PreconBoqRowDto;
  mergedRowIds: string[];
  createdGeometryIds: string[];
  absorbedGeometryIds: string[];
}

export interface ReassignGeometryBody {
  targetRowId: string;
  operationId?: string;
  expectedRows?: ExpectedVersion[];
  expectedSheets?: ExpectedVersion[];
}

export interface ReassignGeometryResult {
  sourceRow: PreconBoqRowDto;
  targetRow: PreconBoqRowDto;
  /** The source line, when moving its last drawing left it measuring nothing. */
  emptiedRowIds: string[];
}

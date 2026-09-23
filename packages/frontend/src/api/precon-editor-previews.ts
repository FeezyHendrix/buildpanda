// What a proposed scale or region set WOULD do to the bill. Every type here
// answers a preview route that writes nothing: the figures are shown so a
// calibration is committed having been seen, never applied on trust.
/**
 * One bill line as the proposed scale would leave it. `hasUnresolvableBasis`
 * marks a line whose tool cannot be established from its stored definition;
 * the apply leaves it exactly as found rather than guessing a figure.
 */
export interface CalibrationPreviewRow {
  rowId: string;
  description: string;
  /** The row version the figures were read at; the apply is pinned to it. */
  version: number;
  currentQtyGross: number | null;
  newQtyGross: number | null;
  currentQty: number | null;
  newQty: number | null;
  unit: string | null;
  /** How many shapes were added up — a line is rarely one. */
  contributions: number;
  hasUnresolvableBasis: boolean;
}

export interface ScaleSuggestion {
  rowId: string;
  geometryId: string;
  proposedViewportId: string | null;
  unconfirmed: boolean;
}

export interface CalibrationPreview {
  sheetId: string;
  /** Null on a sheet nobody has scaled yet. */
  currentScaleMmPerPt: number | null;
  newScaleMmPerPt: number;
  sheetVersion: number;
  affectedRows: CalibrationPreviewRow[];
  unresolvedCount: number;
  unresolvedRowIds: string[];
  /** True when an unresolved line means the apply will be refused outright. */
  blocked: boolean;
  rebindSuggestions: ScaleSuggestion[];
  legacySuggestions: ScaleSuggestion[];
  previewToken: string;
}

export interface SheetViewportInput {
  id?: string;
  label: string;
  rect: [number, number, number, number];
  scaleMmPerPt: number;
}

export interface ViewportPreviewBody {
  viewports: SheetViewportInput[];
  version: number;
}

export interface ViewportImpactRow {
  rowId: string;
  description: string;
  version: number;
  currentQtyGross: number | null;
  newQtyGross: number;
  currentQty: number | null;
  newQty: number;
  unit: string | null;
}

/** A region being withdrawn, and what was measured inside it. */
export interface RemovedRegion {
  viewportId: string;
  label: string;
  measurements: { rowId: string; geometryId: string; description: string }[];
}

export interface ViewportPreview {
  sheetId: string;
  sheetVersion: number;
  rescaled: ViewportImpactRow[];
  removed: RemovedRegion[];
  /**
   * Lines whose basis is unrecorded: a HARD block no flag overrides — the basis
   * must be confirmed first. `removed` alone is clearable with `confirmed: true`.
   */
  unresolvedRowIds: string[];
  blocked: boolean;
  previewToken: string;
}

export interface CalibrationPreviewBody {
  newScaleMmPerPt: number;
  version: number;
}

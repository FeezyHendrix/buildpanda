// What a bulk take-off edit is allowed to do, as pure decisions.
//
// Splitting a run, cutting a segment out of it, merging slabs and moving a
// drawing to another line are all one question before they are any kind of
// write: is the result still a measurement somebody can defend? Keeping the
// answers here — no database, no transaction, no context — is what lets them
// be checked in full before a single row moves, which is the difference
// between refusing an operation and half-committing one.

import { BadRequestError, ConflictError } from "../../../lib/errors.ts";
import { polygonUnionStructured, type PolygonWithHoles, type VertexRing } from "./measurement-topology.ts";
import type { ExpectedVersion, MeasureFactor, MeasureTool, PreconBoqRowRow, PreconSheetRow } from "./types.ts";

export interface SplitPieces {
  left: number[][];
  right: number[][];
}

/**
 * The run cut in two at a drawn vertex. The cut point belongs to both pieces,
 * so the two lengths still add up to the one that was signed off — a split
 * re-describes a measurement, it never changes what was measured.
 */
export function splitVerticesAt(vertices: number[][], index: number): SplitPieces {
  if (!Number.isInteger(index) || index <= 0 || index >= vertices.length - 1) {
    throw new BadRequestError(
      `Split at vertex ${index} would cut nothing off: pick a point between the first and the last of the ${vertices.length} drawn`,
    );
  }
  return { left: vertices.slice(0, index + 1), right: vertices.slice(index) };
}

const samePoint = (a: number[], b: number[]): boolean => a[0] === b[0] && a[1] === b[1];

const MIN_CLOSED_POINTS = 4;

/**
 * The run with one side taken out, as the pieces that actually remain.
 *
 * A closed perimeter survives any cut — it re-roots into a single open path. An
 * open run cut at either end stays one run. An INTERIOR cut leaves two runs, and
 * that is a real answer, not a refusal: a bill line is measured by however many
 * drawings it carries, so both pieces stay on it and the line is re-added from
 * both. The old version returned null here and the caller refused the edit.
 *
 * A piece of fewer than two points is dropped: a single point is not a run.
 */
export function removeSegmentFrom(vertices: number[][], index: number): number[][][] {
  const last = vertices.length - 1;
  if (!Number.isInteger(index) || index < 0 || index > last - 1) {
    throw new BadRequestError(`Segment ${index} is not one of the ${Math.max(0, last)} drawn on this line`);
  }
  if (vertices.length >= MIN_CLOSED_POINTS && samePoint(vertices[0]!, vertices[last]!)) {
    const ring = vertices.slice(0, last);
    const start = (index + 1) % ring.length;
    return [Array.from({ length: ring.length }, (_, step) => ring[(start + step) % ring.length]!)];
  }
  const left = vertices.slice(0, index + 1);
  const right = vertices.slice(index + 1);
  const pieces = [left, right].filter((piece) => piece.length >= 2);
  if (pieces.length === 0) throw new BadRequestError("Removing that segment would leave nothing measured");
  return pieces;
}

// ---------- merge ----------

/** Everything about a line that has to match before its area may be merged into another. */
export interface MergeCandidate {
  rowId: string;
  sheetId: string;
  tool: MeasureTool;
  factor: MeasureFactor;
  unit: string | null;
  typical: number;
  rate: number | null;
}

/**
 * Why these two lines cannot become one, in the QS's own terms, or null when
 * they can. Merging lines measured differently produces a single quantity that
 * no longer means what either of them meant — so the refusal has to name what
 * differs, not just decline.
 */
export function mergeMismatch(keep: MergeCandidate, other: MergeCandidate): string | null {
  // Unit is compared FIRST because it is the reason a QS can act on. An area
  // and a run were refused on their shape kind — "drawn as linear, not an
  // area" — which named a drawing when the real objection is that m² and m
  // cannot become one figure, and which refused every compatible pair of runs
  // along with them.
  const compared: [string, string | number | null, string | number | null][] = [
    ["unit", keep.unit, other.unit],
    ["sheet", keep.sheetId, other.sheetId],
    ["tool", keep.tool, other.tool],
    ["height factor", keep.factor.heightM ?? null, other.factor.heightM ?? null],
    ["depth factor", keep.factor.depthM ?? null, other.factor.depthM ?? null],
    ["typical", keep.typical, other.typical],
    ["rate", keep.rate, other.rate],
  ];
  for (const [what, mine, theirs] of compared) {
    if (mine === theirs) continue;
    return `line ${other.rowId} has a different ${what} (${String(theirs)} against ${String(mine)})`;
  }
  return null;
}

/**
 * What these areas make together, as the bill has to express it: one entry per
 * disjoint outline, each with its voids.
 *
 * Overlapping slabs come back as one outline measured once. Bars around a
 * courtyard come back as one outline with a hole, which the writer bills as a
 * parent plus an explicit deduction ring. Slabs that do not touch come back as
 * several outlines, all billed on the one line — never joined by an invented
 * edge, which would state a figure for a region nobody drew.
 */
export function unionShapes(rings: VertexRing[]): PolygonWithHoles[] {
  const merged = polygonUnionStructured(rings);
  if (merged.length === 0) throw new BadRequestError("These areas do not enclose anything to merge");
  return merged;
}

// ---------- reassignment ----------

export interface ReassignCandidate {
  unit: string | null;
  tool: MeasureTool;
  typical: number;
}

/**
 * Why this drawing cannot move to that line, or null when it can. A shape
 * measured as a 2.7 m-high wall carries no meaning on a line billed in m3, and
 * a run counted once cannot land on a line repeated over four floors — both
 * would leave a quantity that still prices and no longer measures anything.
 */
export function reassignMismatch(source: ReassignCandidate, target: ReassignCandidate): string | null {
  if (source.unit !== target.unit) {
    return `the lines are billed in different units (${source.unit ?? "none"} against ${target.unit ?? "none"})`;
  }
  if (source.tool !== target.tool) {
    return `the lines were measured with different tools (${source.tool} against ${target.tool})`;
  }
  if (source.typical !== target.typical) {
    return `the lines repeat over a different number of typical floors (${source.typical} against ${target.typical})`;
  }
  return null;
}

export const asRing = (vertices: number[][]): VertexRing => vertices.map((v) => [v[0]!, v[1]!]);

// ---------- expected versions ----------
//
// An edit that restates a line the caller never opened is the one way these
// commands can quietly overwrite somebody's work. So every row and sheet they
// touch must be named with the version the client believed was current: an
// unnamed one is a client that did not know it was changing it, and a stale
// one is a state nobody reviewed. Both refuse before anything is written.

// An EMPTY list means the caller is the operation envelope, which has already
// checked `expectedRows`/`expectedSheets` against the live records and owns the
// idempotency. A NON-empty list that omits this row is still a client that did
// not know it was changing it.
export function assertRowVersion(row: PreconBoqRowRow, expected: ExpectedVersion[]): void {
  if (expected.length === 0) return;
  const held = expected.find((e) => e.id === row.id);
  if (!held) throw new BadRequestError(`Send the version you hold for line ${row.id}; this edit restates it`);
  if (held.version !== row.version) {
    throw new ConflictError(`Row ${row.id} was updated by someone else (current version ${row.version}); refresh and reapply`);
  }
}

export function assertSheetVersion(sheet: PreconSheetRow, expected: ExpectedVersion[]): void {
  if (expected.length === 0) return;
  const held = expected.find((e) => e.id === sheet.id);
  if (!held) throw new BadRequestError(`Send the version you hold for sheet ${sheet.id}; this edit is measured against it`);
  const current = sheet.version ?? 1;
  if (held.version !== current) {
    throw new ConflictError(`Sheet was updated by someone else (current version ${current}); refresh and reapply`);
  }
}

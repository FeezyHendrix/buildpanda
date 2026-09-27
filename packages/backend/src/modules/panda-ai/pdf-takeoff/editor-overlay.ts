// Laying one revision of a drawing over another, and recording how.
//
// An alignment is a claim about two drawings: that THESE three points on the
// old sheet are THOSE three points on the new one. A QS reads a revision cloud
// off it and raises a variation, so it is a record, not a view setting — kept in
// component state it dies on refresh and the reading cannot be reproduced.
//
// Three things it must never become:
//
//   * a quantity change. It moves no figure and clears no sign-off; it is
//     written through the same versioned envelope purely so it is attributed,
//     ordered and reversible like everything else.
//   * an alignment of unrelated drawings. Overlaying another job's sheet
//     produces a picture that looks like a revision comparison and is not, so
//     the source must belong to this take-off's own lineage.
//   * a stretch that flatters. Three points on one line define no affine at
//     all; the least-squares fit through them silently collapses the drawing.
//     Collinear anchors are refused rather than resolved.

import { BadRequestError } from "../../../lib/errors.ts";
import type { PreconSessionRow, PreconSheetRow } from "./types.ts";

export type OverlayPoint = [number, number];

export interface OverlayAnchorPair {
  source: OverlayPoint;
  target: OverlayPoint;
}

/** `[a, b, c, d, e, f]`: tx = a·sx + c·sy + e, ty = b·sx + d·sy + f. */
export type AffineMatrix = [number, number, number, number, number, number];

export interface OverlaySettingsV1 {
  schemaVersion: 1;
  sourceSheetId: string;
  targetSheetId: string;
  /** The take-off each drawing belongs to, so the comparison names its revisions. */
  sourceRevisionId: string;
  targetRevisionId: string;
  opacity: number;
  anchors: [OverlayAnchorPair, OverlayAnchorPair, OverlayAnchorPair];
  matrix: AffineMatrix;
  actor: string;
  time: string;
}

export interface OverlayInput {
  sourceSheetId: string;
  opacity: number;
  anchors: { source: number[]; target: number[] }[];
}

/** Contract 16's degeneracy tolerance, applied to the triangle the anchors make. */
const DEGENERACY = 1e-9;

const asPoint = (value: number[], what: string): OverlayPoint => {
  const [x, y] = value;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new BadRequestError(`Every ${what} reference point needs a finite x and y on the drawing`);
  }
  return [x, y];
};

const spanOf = (points: OverlayPoint[]): number => {
  let span = 0;
  for (const a of points) for (const b of points) span = Math.max(span, Math.hypot(a[0] - b[0], a[1] - b[1]));
  return span;
};

/**
 * Twice the signed area of the triangle the three points make. Zero means they
 * lie on one line, and a line cannot fix a rotation or a scale — only a shift
 * along itself.
 */
function assertNotCollinear(points: OverlayPoint[], what: string): void {
  const [p, q, r] = points as [OverlayPoint, OverlayPoint, OverlayPoint];
  const cross = (q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1]);
  const span = Math.max(1, spanOf(points));
  if (Math.abs(cross) <= DEGENERACY * span * span) {
    throw new BadRequestError(
      `The three ${what} reference points lie on one line, so they fix no alignment — ` +
        "a line cannot say how the drawing is rotated or scaled across it. Pick three points that form a triangle.",
    );
  }
}

/**
 * The affine taking the source drawing onto the target, solved exactly from the
 * three pairs by Cramer's rule. Exact rather than least-squares on purpose:
 * three pairs determine one affine, and a fit would quietly absorb a mis-picked
 * point instead of reproducing what the QS actually clicked.
 */
export function affineFrom(anchors: [OverlayAnchorPair, OverlayAnchorPair, OverlayAnchorPair]): AffineMatrix {
  const [p, q, r] = anchors;
  const det =
    (q.source[0] - p.source[0]) * (r.source[1] - p.source[1]) -
    (r.source[0] - p.source[0]) * (q.source[1] - p.source[1]);

  const solve = (t0: number, t1: number, t2: number): [number, number, number] => {
    const dA = (t1 - t0) * (r.source[1] - p.source[1]) - (t2 - t0) * (q.source[1] - p.source[1]);
    const dC = (q.source[0] - p.source[0]) * (t2 - t0) - (r.source[0] - p.source[0]) * (t1 - t0);
    const a = dA / det;
    const c = dC / det;
    return [a, c, t0 - a * p.source[0] - c * p.source[1]];
  };

  const [a, c, e] = solve(p.target[0], q.target[0], r.target[0]);
  const [b, d, f] = solve(p.target[1], q.target[1], r.target[1]);
  return [a, b, c, d, e, f];
}

export interface OverlayLineage {
  target: { sheet: PreconSheetRow; session: PreconSessionRow };
  source: { sheet: PreconSheetRow; session: PreconSessionRow };
}

/**
 * Two drawings are comparable when they are the same take-off, or two take-offs
 * of the same plan measured the same way. Anything else is a different job, and
 * a revision comparison against it reads as evidence while being none.
 *
 * Sessions with no plan are ad-hoc uploads with no lineage to share, so for
 * those only the same session qualifies.
 */
export function assertSameLineage({ target, source }: OverlayLineage): void {
  if (source.session.org_id !== target.session.org_id) {
    throw new BadRequestError("That drawing belongs to another organisation");
  }
  if (source.session.id === target.session.id) return;

  const plan = target.session.plan_id;
  const sameLineage =
    plan !== null &&
    plan !== undefined &&
    source.session.plan_id === plan &&
    (source.session.takeoff_kind ?? "pdf") === (target.session.takeoff_kind ?? "pdf");
  if (!sameLineage) {
    throw new BadRequestError(
      "That drawing is not a revision of this one — it belongs to a different take-off. " +
        "Only revisions of the same plan, measured the same way, can be laid over each other.",
    );
  }
}

export function overlaySettingsFrom(
  input: OverlayInput,
  lineage: OverlayLineage,
  actor: string,
): OverlaySettingsV1 {
  if (!(typeof input.opacity === "number" && Number.isFinite(input.opacity) && input.opacity >= 0 && input.opacity <= 1)) {
    throw new BadRequestError("Overlay opacity is a fraction between 0 and 1");
  }
  if (!Array.isArray(input.anchors) || input.anchors.length !== 3) {
    throw new BadRequestError("An alignment needs exactly three reference points on each drawing");
  }
  const anchors = input.anchors.map((pair) => ({
    source: asPoint(pair.source ?? [], "source"),
    target: asPoint(pair.target ?? [], "target"),
  })) as [OverlayAnchorPair, OverlayAnchorPair, OverlayAnchorPair];

  assertNotCollinear(anchors.map((pair) => pair.source), "source");
  assertNotCollinear(anchors.map((pair) => pair.target), "target");
  assertSameLineage(lineage);

  return {
    schemaVersion: 1,
    sourceSheetId: lineage.source.sheet.id,
    targetSheetId: lineage.target.sheet.id,
    sourceRevisionId: lineage.source.session.id,
    targetRevisionId: lineage.target.session.id,
    opacity: input.opacity,
    anchors,
    matrix: affineFrom(anchors),
    actor,
    time: new Date().toISOString(),
  };
}

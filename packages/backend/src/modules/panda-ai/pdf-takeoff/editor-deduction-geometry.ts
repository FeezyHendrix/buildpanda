// Where an opening is allowed to be, and what it is worth.
//
// Two rules decide whether a cut is a measurement or a mistake, and both are
// silent failures if they are not enforced:
//
//   * It must lie INSIDE the shape it is cut out of. An opening drawn beside a
//     slab still subtracts, so the line under-measures by a figure that looks
//     drawn and still prices.
//   * It must not overlap another opening on the same line, or the shared strip
//     comes off twice.
//
// Both are measured as real polygon operations, not bounding boxes: a door reveal
// and a window head routinely share a box without sharing any area. The tolerance
// is contract 16's `1e-6 m²` — small enough that a cut genuinely outside is always
// caught, and large enough that two openings sharing an exact edge are not
// reported as overlapping. It replaced `0.005 m²`, which is half a centimetre
// squared: a real 40 cm² overlap passed as "rounds away".
//
// A wall opening is the case that cannot be drawn at all. It is a width × height
// off an elevation; the plan shows only its footprint, so measuring the drawn
// shape would bill the wrong dimension. Those arrive as stated dimensions.

import { BadRequestError } from "../../../lib/errors.ts";
import { polygonDifference, polygonIntersection, type VertexRing } from "./measurement-topology.ts";
import { polygonAreaM2 } from "./measurements.ts";
import type { DeductionMode } from "./editor-types.ts";

/** Contract 16: exact touching boundaries are retained, real overlap is not. */
export const AREA_TOLERANCE_M2 = 1e-6;

export const asRing = (vertices: number[][]): VertexRing => vertices.map((v) => [v[0]!, v[1]!]);

const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * The part of the cut that falls outside its parent. Zero (within tolerance) when
 * the opening is wholly contained, including when it shares an edge exactly.
 */
export function areaOutside(cut: number[][], parent: number[][], mmPerPt: number): number {
  return polygonDifference(asRing(cut), asRing(parent)).reduce(
    (total, piece) => total + polygonAreaM2(piece, mmPerPt),
    0,
  );
}

export function assertInsideParent(cut: number[][], parent: number[][], mmPerPt: number): void {
  if (parent.length < 3 || cut.length < 3) return;
  const outside = areaOutside(cut, parent, mmPerPt);
  if (outside > AREA_TOLERANCE_M2) {
    throw new BadRequestError(
      `This opening is not inside the measurement it is cut out of — ${round2(outside)} m2 of it falls outside. ` +
        "Redraw it within the shape, or take it off the line it actually belongs to.",
    );
  }
}

export function assertNoOverlap(cut: number[][], siblings: number[][][], mmPerPt: number): void {
  const ring = asRing(cut);
  for (const other of siblings) {
    if (other.length < 3) continue;
    const shared = polygonIntersection(ring, asRing(other)).reduce(
      (total, piece) => total + polygonAreaM2(piece, mmPerPt),
      0,
    );
    if (shared > AREA_TOLERANCE_M2) {
      throw new BadRequestError(
        `This opening overlaps another deduction on the same line by ${round2(shared)} m2; the shared area would be taken off twice`,
      );
    }
  }
}

export interface StatedCut {
  qty: number;
  unit: string;
  mode: DeductionMode;
  dimensions: { widthM?: number; heightM?: number; depthM?: number };
}

const positive = (value: number | undefined, what: string): number => {
  if (!(typeof value === "number" && Number.isFinite(value) && value > 0)) {
    throw new BadRequestError(`State the ${what} of this opening as a positive number of metres`);
  }
  return value;
};

/**
 * An opening given as dimensions rather than a drawing. `wall-opening` is
 * width × height because a wall is billed as an elevation; a volume opening also
 * needs the depth it is cut through.
 */
export function statedCut(
  mode: DeductionMode,
  dimensions: { widthM?: number; heightM?: number; depthM?: number } | undefined,
  parentUnit: string | null,
): StatedCut {
  const dims = dimensions ?? {};
  switch (mode) {
    case "wall-opening": {
      const widthM = positive(dims.widthM, "width");
      const heightM = positive(dims.heightM, "height");
      if (parentUnit !== "m2") {
        throw new BadRequestError(`A wall opening comes off a line billed in m2, not ${parentUnit ?? "no unit"}`);
      }
      return { qty: round2(widthM * heightM), unit: "m2", mode, dimensions: { widthM, heightM } };
    }
    case "volume": {
      const widthM = positive(dims.widthM, "width");
      const heightM = positive(dims.heightM, "height");
      const depthM = positive(dims.depthM, "depth");
      if (parentUnit !== "m3") {
        throw new BadRequestError(`A stated volume opening comes off a line billed in m3, not ${parentUnit ?? "no unit"}`);
      }
      return { qty: round2(widthM * heightM * depthM), unit: "m3", mode, dimensions: { widthM, heightM, depthM } };
    }
    case "length": {
      const widthM = positive(dims.widthM, "length");
      if (parentUnit !== "m") {
        throw new BadRequestError(`A stated length opening comes off a line billed in m, not ${parentUnit ?? "no unit"}`);
      }
      return { qty: round2(widthM), unit: "m", mode, dimensions: { widthM } };
    }
    case "area": {
      const widthM = positive(dims.widthM, "width");
      const heightM = positive(dims.heightM, "height");
      if (parentUnit !== "m2") {
        throw new BadRequestError(`A stated area opening comes off a line billed in m2, not ${parentUnit ?? "no unit"}`);
      }
      return { qty: round2(widthM * heightM), unit: "m2", mode, dimensions: { widthM, heightM } };
    }
    case "count":
      throw new BadRequestError("Exclude counted items by their number, not by stating dimensions");
  }
}

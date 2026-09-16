import { pitchFromLabels } from "../../dwg-takeoff/roof-shape.ts";
import type { ExtractedSheet, MeasuredBoqItem, Segment } from "../types.ts";

interface RoofPolygon {
  points: number[][];
  areaUnits: number;
  perimeterUnits: number;
}

function polygonOf(pathSegments: Segment[]): RoofPolygon | null {
  if (pathSegments.length < 3) return null;
  const first = pathSegments[0]!;
  const points: number[][] = [[first.x1, first.y1]];
  for (const segment of pathSegments) points.push([segment.x2, segment.y2]);
  if (points.length < 4) return null;
  let doubled = 0;
  let perimeter = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    doubled += a[0]! * b[1]! - b[0]! * a[1]!;
    perimeter += Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
  }
  const areaUnits = Math.abs(doubled / 2);
  return areaUnits > 0 ? { points: points.slice(0, -1), areaUnits, perimeterUnits: perimeter } : null;
}

function largestClosedPolygon(segments: Segment[]): RoofPolygon | null {
  const byPath = new Map<number, Segment[]>();
  for (const segment of segments) {
    if (!segment.closed || segment.path === undefined) continue;
    const path = byPath.get(segment.path);
    if (path) path.push(segment);
    else byPath.set(segment.path, [segment]);
  }
  let largest: RoofPolygon | null = null;
  for (const path of byPath.values()) {
    const polygon = polygonOf(path);
    if (polygon && (!largest || polygon.areaUnits > largest.areaUnits)) largest = polygon;
  }
  return largest;
}

/** Measure the covering footprint and boundary from a vector roof plan. */
export function measureRoofPlan(
  extracted: ExtractedSheet,
  mmPerPt: number,
  calibrationConfidence: number,
  pageNumber: number,
  sheetLabel: string,
): MeasuredBoqItem[] {
  const polygon = largestClosedPolygon(extracted.segments);
  if (!polygon) return [];
  const toM = mmPerPt / 1000;
  const planAreaM2 = polygon.areaUnits * toM * toM;
  if (planAreaM2 < 2) return [];
  const perimeterM = polygon.perimeterUnits * toM;
  const pitch = pitchFromLabels(extracted.texts.map((text) => text.str));
  const slopeFactor = pitch === null ? 1 : 1 / Math.cos((pitch * Math.PI) / 180);
  const coveredAreaM2 = Math.round(planAreaM2 * slopeFactor * 100) / 100;
  const confidence = pitch === null || calibrationConfidence < 0.7 ? "low" : "high";
  const pitchNote = pitch === null
    ? "pitch is not stated, so the plan area is returned and must be checked against sections"
    : `plan area adjusted by ×${slopeFactor.toFixed(3)} for the stated ${pitch}° pitch`;
  const outline = polygon.points;
  return [
    {
      elementGroup: "Roof",
      workSection: { code: "1.17", title: "SHEET ROOF COVERING" },
      specNote: null,
      code: "1.17",
      description: `Roof covering${pitch === null ? "; measured on plan" : `; ${pitch}° pitch`}; sheet type per roof schedule`,
      unit: "m2",
      qtyGross: coveredAreaM2,
      deductions: [],
      qty: coveredAreaM2,
      confidence,
      confidenceReason: pitch === null ? "pitch not stated on roof plan" : calibrationConfidence < 0.7 ? "scale" : null,
      measurementBasis: `${planAreaM2.toFixed(2)} m² inside the roof outline on ${sheetLabel}; ${pitchNote}`,
      geometries: [{ kind: "area", vertices: outline, quantity: coveredAreaM2, unit: "m2" }],
      pageNumber,
    },
    {
      elementGroup: "Roof",
      workSection: { code: "1.17", title: "SHEET ROOF COVERING" },
      specNote: null,
      code: "1.17",
      description: "Eaves: fascia, soffit and gutter around roof outline",
      unit: "m",
      qtyGross: Math.round(perimeterM * 100) / 100,
      deductions: [],
      qty: Math.round(perimeterM * 100) / 100,
      confidence,
      confidenceReason: confidence === "low" ? "scale or pitch needs review" : null,
      measurementBasis: `${perimeterM.toFixed(2)} m around the roof outline on ${sheetLabel}`,
      geometries: [{ kind: "linear", vertices: [...outline, outline[0]!], quantity: perimeterM, unit: "m" }],
      pageNumber,
    },
  ];
}

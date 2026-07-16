import type { Confidence, MeasuredBoqItem, Segment } from "../types.ts";

export interface CivilMeasurement {
  pavedAreaM2: number;
  roadLengthM: number;
  edgeCount: number;
}

const M2_PER_PT2 = (mmPerPt: number): number => (mmPerPt / 1000) * (mmPerPt / 1000);

function isLongLine(s: Segment): boolean {
  return s.len > 50;
}

// The paved extent of a road/runway/apron sheet is the bounding footprint of
// its long linework. Measuring the axis-aligned bounding area of the long
// edge/kerb lines gives the paved surface area (m2) as a QS anchor; the course
// build-up (depth bands) is applied by the pavement brief, not guessed here.
function boundingAreaM2(segments: Segment[], mmPerPt: number): number {
  const lines = segments.filter(isLongLine);
  if (lines.length < 2) return 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of lines) {
    minX = Math.min(minX, s.x1, s.x2);
    minY = Math.min(minY, s.y1, s.y2);
    maxX = Math.max(maxX, s.x1, s.x2);
    maxY = Math.max(maxY, s.y1, s.y2);
  }
  const areaPt2 = (maxX - minX) * (maxY - minY);
  return areaPt2 * M2_PER_PT2(mmPerPt);
}

// Road/kerb length is the run of the dominant direction: the summed length of
// the longest near-parallel long lines (the carriageway edges), taking the
// longer axis span so a plan drawn along either axis reads correctly.
function dominantRunM(segments: Segment[], mmPerPt: number): number {
  const lines = segments.filter(isLongLine);
  if (lines.length < 2) return 0;
  let horizExtent = 0;
  let vertExtent = 0;
  for (const s of lines) {
    const dx = Math.abs(s.x2 - s.x1);
    const dy = Math.abs(s.y2 - s.y1);
    if (dx >= dy) horizExtent = Math.max(horizExtent, dx);
    else vertExtent = Math.max(vertExtent, dy);
  }
  const runPt = Math.max(horizExtent, vertExtent);
  return (runPt * mmPerPt) / 1000;
}

export function measureCivil(segments: Segment[], mmPerPt: number): CivilMeasurement {
  const edgeCount = segments.filter(isLongLine).length;
  return {
    pavedAreaM2: Math.round(boundingAreaM2(segments, mmPerPt) * 100) / 100,
    roadLengthM: Math.round(dominantRunM(segments, mmPerPt) * 100) / 100,
    edgeCount,
  };
}

// Emits paved-surface and road-length anchors from measured plan geometry.
// These are measured spans, not fabricated: with too little linework to bound
// a surface the detector returns NOTHING rather than inventing an area.
export function civilToItems(measurement: CivilMeasurement, pageNumber: number): MeasuredBoqItem[] {
  const items: MeasuredBoqItem[] = [];
  const confidence: Confidence = "low";
  if (measurement.pavedAreaM2 > 0) {
    items.push({
      elementGroup: "External works",
      workSection: { code: "2T", title: "ROADS AND PAVINGS" },
      specNote: "Pavement construction to pavement design; surface area measured from plan extent",
      groupHeading: "Pavement",
      code: "PV1",
      description: "Paved surface area; pavement course build-up per pavement design",
      unit: "m2",
      qtyGross: measurement.pavedAreaM2,
      deductions: [],
      qty: measurement.pavedAreaM2,
      confidence,
      measurementBasis: `Paved surface area ${measurement.pavedAreaM2} m2 measured from plan extent (page ${pageNumber}); course depths from pavement design`,
      geometries: [],
      pageNumber,
    });
  }
  if (measurement.roadLengthM > 0) {
    items.push({
      elementGroup: "External works",
      workSection: { code: "2T", title: "ROADS AND PAVINGS" },
      specNote: "Kerbs and channels to road edges",
      groupHeading: "Kerbs and edgings",
      code: "PV2",
      description: "Road/pavement length; for kerbs, channels and edge treatment",
      unit: "m",
      qtyGross: measurement.roadLengthM,
      deductions: [],
      qty: measurement.roadLengthM,
      confidence,
      measurementBasis: `Road run ${measurement.roadLengthM} m measured from dominant carriageway edge (page ${pageNumber})`,
      geometries: [],
      pageNumber,
    });
  }
  return items;
}

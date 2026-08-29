import type { CalibrationResult, DimUnit, Segment, TextRun } from "../types.ts";

// Standard architectural scales the multiplier search snaps to.
const STANDARD_SCALES = [20, 25, 50, 75, 100, 125, 200, 250, 500] as const;
const PT_TO_MM = 0.3528; // 1 pt at paper scale

const CLUSTER_TOLERANCE = 1.03;
const MIN_DIM_VALUE = 100;
const MAX_DIM_VALUE = 20000;
const SCALE_SNAP_MAX_ERROR = 0.06;

interface DimensionText extends TextRun {
  value: number;
}

function dimensionTexts(texts: TextRun[]): DimensionText[] {
  return texts
    .filter((t) => /^[0-9][0-9,]*$/.test(t.str))
    .map((t) => ({ ...t, value: Number(t.str.replace(/,/g, "")) }))
    .filter((t) => t.value >= MIN_DIM_VALUE && t.value <= MAX_DIM_VALUE);
}

// A dimension line is the segment its text annotation sits on: parallel to the
// text, centred under it, offset by a small perpendicular gap.
function matchRatios(dims: DimensionText[], segments: Segment[]): number[] {
  const ratios: number[] = [];
  const horizontal = segments.filter((s) => Math.abs(s.y1 - s.y2) < 0.3 && s.len >= 6 && s.len <= 600);
  const vertical = segments.filter((s) => Math.abs(s.x1 - s.x2) < 0.3 && s.len >= 6 && s.len <= 600);

  for (const t of dims) {
    if (!t.rotated) {
      const cx = t.x + t.w / 2;
      for (const s of horizontal) {
        const mid = (s.x1 + s.x2) / 2;
        if (Math.abs(mid - cx) > Math.max(4, s.len * 0.25)) continue;
        const dy = Math.abs(s.y1 - t.y);
        if (dy < 0.8 || dy > 10) continue;
        ratios.push(t.value / s.len);
      }
    } else {
      const cy = t.y + t.w / 2;
      for (const s of vertical) {
        const mid = (s.y1 + s.y2) / 2;
        if (Math.abs(mid - cy) > Math.max(4, s.len * 0.25)) continue;
        const dx = Math.abs(s.x1 - t.x);
        if (dx < 0.8 || dx > 10) continue;
        ratios.push(t.value / s.len);
      }
    }
  }
  return ratios;
}

function densestCluster(sorted: number[]): { count: number; value: number } {
  let best = { count: 0, value: 0 };
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j < sorted.length && sorted[j]! <= sorted[i]! * CLUSTER_TOLERANCE) j++;
    if (j - i > best.count) best = { count: j - i, value: sorted[Math.floor((i + j) / 2)]! };
  }
  return best;
}

// Dimensions may be annotated in mm, cm or m; pick the multiplier whose implied
// drawing scale lands nearest a standard architectural scale, then SNAP to that
// exact scale. Drawings are drawn at an exact standard scale, so the true mmPerPt
// is standard * PT_TO_MM — snapping removes the dimension-measurement noise (a raw
// ratio 4% off 1:100 would otherwise put a 4% error on every quantity).
function inferUnit(rawMmPerPt: number): { mmPerPt: number; unit: DimUnit; error: number } {
  let best: { mmPerPt: number; unit: DimUnit; error: number } = { mmPerPt: rawMmPerPt, unit: "mm", error: Infinity };
  const units: { mul: number; unit: DimUnit }[] = [
    { mul: 1, unit: "mm" },
    { mul: 10, unit: "cm" },
    { mul: 1000, unit: "m" },
  ];
  for (const { mul, unit } of units) {
    const implied = (rawMmPerPt * mul) / PT_TO_MM;
    for (const standard of STANDARD_SCALES) {
      const error = Math.abs(implied - standard) / standard;
      if (error < best.error) best = { mmPerPt: standard * PT_TO_MM, unit, error };
    }
  }
  return best;
}

// The drawing's own stated scale ("SCALE 1:100", "1 : 100", "1:50 @ A3") is the
// most reliable calibration source and needs no dimension-line geometry — a real
// dimension line often does not match the strict tick geometry, so relying on
// geometry alone fails on many CAD exports that DO print their scale.
function writtenScale(texts: TextRun[]): number | null {
  const joined = texts.map((t) => t.str).join(" ");
  const counts = new Map<number, number>();
  for (const m of joined.matchAll(/\b1\s*[:/]\s*(\d{1,4})\b/g)) {
    const denom = Number(m[1]);
    // Any architectural drawing scale (1:10..1:1000), not only the "standard"
    // set — real sheets use 1:120, 1:150 etc. A "1:11" from a revision label is
    // excluded by the lower bound.
    if (denom >= 10 && denom <= 1000) counts.set(denom, (counts.get(denom) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let best = 0;
  let bestCount = 0;
  for (const [scale, c] of counts) if (c > bestCount || (c === bestCount && (STANDARD_SCALES as readonly number[]).includes(scale))) [best, bestCount] = [scale, c];
  return best > 0 ? best : null;
}

export function calibrate(texts: TextRun[], segments: Segment[]): CalibrationResult | null {
  const dims = dimensionTexts(texts);
  const ratios = matchRatios(dims, segments).sort((a, b) => a - b);

  // Dimension-line geometry gives the strongest calibration when it agrees.
  if (ratios.length >= 3) {
    const cluster = densestCluster(ratios);
    const clusterAgreement = cluster.count / ratios.length;
    const { mmPerPt, unit, error } = inferUnit(cluster.value);
    if (clusterAgreement >= 0.3 && error <= SCALE_SNAP_MAX_ERROR) {
      const snapConfidence = 1 - error / SCALE_SNAP_MAX_ERROR;
      return {
        mmPerPt,
        confidence: Math.round(clusterAgreement * snapConfidence * 100) / 100,
        dimUnit: unit,
        matches: cluster.count,
      };
    }
  }

  // Fallback: the drawing states its scale in text. Trust it (medium confidence)
  // rather than refusing to measure a fully-dimensioned sheet.
  const stated = writtenScale(texts);
  if (stated !== null) {
    return { mmPerPt: stated * PT_TO_MM, confidence: 0.6, dimUnit: "mm", matches: 0 };
  }
  return null;
}

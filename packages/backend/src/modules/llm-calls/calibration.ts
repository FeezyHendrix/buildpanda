export interface OutcomeSample {
  band: string;
  needsCorrection: boolean;
}

export interface BandCalibration {
  band: string;
  total: number;
  correctionRate: number;
}

// Calibration = does a "worse" predicted band actually correlate with a higher
// correction rate? For LLM calls the band is validation_status and correction =
// repaired|failed; for takeoff it is the detection confidence and correction =
// edited|rejected. Same shape, so this stays domain-agnostic and pure.
export function computeCalibration(samples: OutcomeSample[]): BandCalibration[] {
  const byBand = new Map<string, { total: number; corrections: number }>();
  for (const sample of samples) {
    const entry = byBand.get(sample.band) ?? { total: 0, corrections: 0 };
    entry.total += 1;
    if (sample.needsCorrection) entry.corrections += 1;
    byBand.set(sample.band, entry);
  }
  return [...byBand.entries()]
    .map(([band, { total, corrections }]) => ({
      band,
      total,
      correctionRate: total === 0 ? 0 : corrections / total,
    }))
    .sort((a, b) => a.band.localeCompare(b.band));
}

// A single 0..1 score: the fraction of ordered band pairs whose correction rates
// move in the expected direction (worse band -> higher rate). 1 = perfectly
// calibrated ordering, 0.5 = no signal. `order` lists bands best-to-worst.
export function calibrationScore(bands: BandCalibration[], order: string[]): number {
  const rank = new Map(order.map((band, index) => [band, index]));
  const ranked = bands
    .filter((b) => rank.has(b.band))
    .sort((a, b) => rank.get(a.band)! - rank.get(b.band)!);
  if (ranked.length < 2) return 0.5;

  let concordant = 0;
  let comparable = 0;
  for (let i = 0; i < ranked.length; i++) {
    for (let j = i + 1; j < ranked.length; j++) {
      comparable += 1;
      if (ranked[j]!.correctionRate >= ranked[i]!.correctionRate) concordant += 1;
    }
  }
  return comparable === 0 ? 0.5 : concordant / comparable;
}

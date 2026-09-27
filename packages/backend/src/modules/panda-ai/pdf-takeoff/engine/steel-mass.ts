// BS4449 / BS8666 reinforcement bar mass, kg per metre, derived from
// mass = (pi/4) * d^2 * 7850 / 1e6 with d the nominal diameter in mm and
// 7850 kg/m3 the density of steel. Tabulated for the standard bar sizes so a
// bar bending schedule row converts to tonnes with no runtime rounding drift.
export const BAR_MASS_KG_PER_M: Record<number, number> = {
  6: 0.222,
  8: 0.395,
  10: 0.617,
  12: 0.888,
  16: 1.578,
  20: 2.466,
  25: 3.854,
  32: 6.313,
  40: 9.864,
};

const SIZES = Object.keys(BAR_MASS_KG_PER_M)
  .map(Number)
  .sort((a, b) => a - b);

export function barMassKgPerM(diameterMm: number): number | null {
  if (BAR_MASS_KG_PER_M[diameterMm] !== undefined) return BAR_MASS_KG_PER_M[diameterMm];
  if (diameterMm <= 0) return null;
  return (Math.PI / 4) * diameterMm * diameterMm * 7850 / 1e6;
}

export function nearestBarSize(diameterMm: number): number {
  return SIZES.reduce((best, s) => (Math.abs(s - diameterMm) < Math.abs(best - diameterMm) ? s : best), SIZES[0]!);
}

export function barTonnes(diameterMm: number, numberOfBars: number, lengthEachMm: number): number | null {
  const kgPerM = barMassKgPerM(diameterMm);
  if (kgPerM === null) return null;
  const kg = kgPerM * numberOfBars * (lengthEachMm / 1000);
  return kg / 1000;
}

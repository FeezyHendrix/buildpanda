// Feet-and-inches text the way US and older Nigerian drawings write it:
// 14'-9 1/8". Lengths stay in millimetres inside the generator; only the
// text an operator would type is imperial.

export const MM_PER_INCH = 25.4;

// Nearest eighth of an inch: "1'-5 3/4"", "9'-10 1/8"", "4'-0"".
export function feetInches(mm: number): string {
  const totalEighths = Math.round((mm / MM_PER_INCH) * 8);
  const feet = Math.floor(totalEighths / 96);
  const remEighths = totalEighths - feet * 96;
  const inches = Math.floor(remEighths / 8);
  let num = remEighths - inches * 8;
  let den = 8;
  while (num > 0 && num % 2 === 0) {
    num /= 2;
    den /= 2;
  }
  const frac = num > 0 ? ` ${num}/${den}` : "";
  return `${feet}'-${inches}${frac}"`;
}

// Millimetres represented by the feet-inches text, rounded as above.
export function feetInchesMm(text: string): number {
  const m = text.match(/^(\d+)'-(\d+)(?:\s+(\d+)\/(\d+))?"$/);
  if (!m) throw new Error(`not feet-inches: ${text}`);
  const inches = Number(m[1]) * 12 + Number(m[2]) + (m[3] ? Number(m[3]) / Number(m[4]) : 0);
  return inches * MM_PER_INCH;
}

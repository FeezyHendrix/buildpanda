/**
 * Affine helpers for the persisted revision overlay (contract: `set-overlay`).
 *
 * The server stores the alignment matrix in SHEET POINT space (y up, origin
 * bottom-left, PDF convention), mapping source-sheet points onto this sheet.
 * The canvas draws in CSS pixels (y down, origin top-left), so the matrix is
 * conjugated through the point→pixel flip before it can be fed to a CSS
 * `matrix(...)` transform.
 */

/** Row-major CSS-style affine: [a, b, c, d, e, f] as in `matrix(a,b,c,d,e,f)`. */
export type Affine = [number, number, number, number, number, number];

export function applyAffine(m: Affine, [x, y]: [number, number]): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export function invertAffine(m: Affine): Affine {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  // A collinear-anchor matrix is refused server-side; a zero determinant here
  // would be a bug upstream, so fall back to identity rather than divide by 0.
  if (det === 0) return [1, 0, 0, 1, 0, 0];
  const ia = d / det;
  const ib = -b / det;
  const ic = -c / det;
  const id = a / det;
  return [ia, ib, ic, id, -(ia * e + ic * f), -(ib * e + id * f)];
}

/** compose(A, B) applies B first, then A. */
export function composeAffine(A: Affine, B: Affine): Affine {
  return [
    A[0] * B[0] + A[2] * B[1],
    A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3],
    A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4],
    A[1] * B[4] + A[3] * B[5] + A[5],
  ];
}

/**
 * Conjugate the sheet-point-space alignment M through the point→canvas-pixel
 * map F (which may carry a pdf.js page matrix, not just a flip): the result
 * F ∘ M ∘ F⁻¹ is the CSS transform for the overlay bitmap in canvas pixels.
 */
export function conjugateAffine(F: Affine, m: Affine): Affine {
  return composeAffine(composeAffine(F, m), invertAffine(F));
}

/** The affine of any linear pt→px function, sampled at three points. */
export function affineOf(map: (pt: number[]) => [number, number]): Affine {
  const o = map([0, 0]);
  const x = map([1, 0]);
  const y = map([0, 1]);
  return [x[0] - o[0], x[1] - o[1], y[0] - o[0], y[1] - o[1], o[0], o[1]];
}

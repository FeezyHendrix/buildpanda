// Repeated-floor detection: architects redraw the same floor across sheets
// (per-unit plans, mirrored blocks). Two plan regions whose geometry agrees
// this closely are the same floor drawn twice — measuring both would double
// the quantities. The fingerprint is deliberately strict: it only collapses
// clear duplicates and leaves genuinely different floors to sum.

export interface PlanFingerprint {
  pageNumber: number;
  centrelineM: number;
  wallPairs: number;
  widthM: number;
  heightM: number;
  doorArcs: number;
  tagSignature: string;
}

export function tagSignature(tags: { windows: Map<string, unknown[]>; doors: Map<string, unknown[]> }): string {
  const parts: string[] = [];
  for (const [key, list] of tags.windows) parts.push(`${key}:${list.length}`);
  for (const [key, list] of tags.doors) parts.push(`${key}:${list.length}`);
  return parts.sort().join(",");
}

function relativeDiff(a: number, b: number): number {
  const max = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return Math.abs(a - b) / max;
}

export function samePlan(a: PlanFingerprint, b: PlanFingerprint): boolean {
  return (
    relativeDiff(a.centrelineM, b.centrelineM) <= 0.03 &&
    Math.abs(a.widthM - b.widthM) <= 0.6 &&
    Math.abs(a.heightM - b.heightM) <= 0.6 &&
    relativeDiff(Math.max(a.doorArcs, 1), Math.max(b.doorArcs, 1)) <= 0.15 &&
    a.tagSignature === b.tagSignature
  );
}

/**
 * Partition page fingerprints into representatives and duplicates.
 * Returns pageNumber -> representative pageNumber (only for duplicates).
 */
export function findDuplicatePlans(fingerprints: PlanFingerprint[]): Map<number, number> {
  const representatives: PlanFingerprint[] = [];
  const duplicateOf = new Map<number, number>();
  for (const fp of fingerprints) {
    const match = representatives.find((rep) => samePlan(rep, fp));
    if (match) duplicateOf.set(fp.pageNumber, match.pageNumber);
    else representatives.push(fp);
  }
  return duplicateOf;
}

// Repeated-floor detection: architects redraw the same floor across sheets
// (per-unit plans, mirrored blocks). Two plan regions whose geometry agrees
// this closely are the same floor drawn twice — measuring both would double
// the quantities. The fingerprint is deliberately strict: it only collapses
// clear duplicates and leaves genuinely different floors to sum.

import type { MeasuredBoqItem } from "../types.ts";

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

export interface PlanGroup {
  members: number[];
  groupSize: number;
}

export interface DuplicatePlans {
  duplicateOf: Map<number, number>;
  groups: Map<number, PlanGroup>;
}

// Partitions floor-plan pages into groups of identical floors. Identical
// typical floors are the SAME drawing repeated, so the representative is
// measured once and multiplied by the group size downstream — dropping the
// duplicates (the old behaviour) under-counts the building.
export function findDuplicatePlans(fingerprints: PlanFingerprint[]): DuplicatePlans {
  const representatives: PlanFingerprint[] = [];
  const groups = new Map<number, PlanGroup>();
  const duplicateOf = new Map<number, number>();
  for (const fp of fingerprints) {
    const match = representatives.find((rep) => samePlan(rep, fp));
    if (match) {
      duplicateOf.set(fp.pageNumber, match.pageNumber);
      const group = groups.get(match.pageNumber)!;
      group.members.push(fp.pageNumber);
      group.groupSize = group.members.length;
    } else {
      representatives.push(fp);
      groups.set(fp.pageNumber, { members: [fp.pageNumber], groupSize: 1 });
    }
  }
  return { duplicateOf, groups };
}

// Drops items from duplicate floor pages and multiplies the representative's
// per-floor items by the group size. Whole-building items (schedules,
// substructure, roof) are left untouched — only floor-plan-scoped quantities
// repeat per identical floor.
export function applyFloorRepetition(items: MeasuredBoqItem[], dup: DuplicatePlans): MeasuredBoqItem[] {
  if (dup.duplicateOf.size === 0) return items;
  return items
    .filter((item) => !dup.duplicateOf.has(item.pageNumber))
    .map((item) => {
      const group = dup.groups.get(item.pageNumber);
      if (!group || group.groupSize <= 1 || item.scope !== "per-floor") return item;
      const n = group.groupSize;
      return {
        ...item,
        qtyGross: Math.round(item.qtyGross * n * 100) / 100,
        qty: Math.round(item.qty * n * 100) / 100,
        deductions: item.deductions.map((d) => ({ ...d, qty: Math.round(d.qty * n * 100) / 100 })),
        confidence: "low" as const,
        measurementBasis: `${item.measurementBasis}; typical floor x ${n} identical floors (pages ${group.members.join(", ")})`,
      };
    });
}

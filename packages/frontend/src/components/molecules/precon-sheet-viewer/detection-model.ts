// Pure state arithmetic for the detection review flows (Room fill, Find
// symbol). No React, no imports: `detection-model.test.ts` runs under the
// plain node runner.

/** Find symbol's result under review: detections, rejections, hand additions. */
export interface SymbolReview {
  name: string | null;
  points: number[][];
  dropped: ReadonlySet<number>;
  /** Markers the reviewer added by hand — part of the same count, never a second row. */
  manual: number[][];
  /** The detection the Prev/Next navigation is looking at. */
  current: number;
  addingMissed: boolean;
  /** Explicitly chosen to keep markers that duplicate already-counted ones. */
  override: boolean;
}

export function emptyReview(name: string | null, points: number[][]): SymbolReview {
  return { name, points, dropped: new Set(), manual: [], current: 0, addingMissed: false, override: false };
}

/** What a Count would commit: the detections not rejected, then the hand additions. */
export function keptWithManual(review: SymbolReview): number[][] {
  return [...review.points.filter((_, i) => !review.dropped.has(i)), ...review.manual];
}

export function toggleDropped(review: SymbolReview, index: number): SymbolReview {
  const dropped = new Set(review.dropped);
  if (dropped.has(index)) dropped.delete(index);
  else dropped.add(index);
  return { ...review, dropped };
}

/** A click in add-missed mode: near an existing manual marker it removes it, otherwise it adds one. */
export function toggleManualAt(review: SymbolReview, pt: number[], thresholdPt: number): SymbolReview {
  const hit = review.manual.findIndex((m) => Math.hypot(m[0]! - pt[0]!, m[1]! - pt[1]!) <= thresholdPt);
  if (hit >= 0) return { ...review, manual: review.manual.filter((_, i) => i !== hit) };
  return { ...review, manual: [...review.manual, [pt[0]!, pt[1]!]] };
}

export function stepCurrent(review: SymbolReview, delta: 1 | -1): SymbolReview {
  const n = review.points.length;
  if (n === 0) return review;
  return { ...review, current: (review.current + delta + n) % n };
}

/** Indices into `combined` that sit on an existing counted marker — the duplicate warning. */
export function duplicateIndices(combined: readonly number[][], existing: readonly number[][], thresholdPt: number): Set<number> {
  const duplicates = new Set<number>();
  combined.forEach((pt, index) => {
    if (existing.some((e) => Math.hypot(e[0]! - pt[0]!, e[1]! - pt[1]!) <= thresholdPt)) duplicates.add(index);
  });
  return duplicates;
}

export interface RequestTicket {
  seq: number;
  sheetId: string;
  tool: string;
}

/**
 * Binds an async detection to the sheet and tool it was fired from: a newer
 * request, a sheet switch or a tool change makes the in-flight answer stale,
 * and a stale answer must change nothing on screen.
 */
export function requestGuard() {
  let liveSeq = 0;
  return {
    begin(sheetId: string, tool: string): RequestTicket {
      liveSeq += 1;
      return { seq: liveSeq, sheetId, tool };
    },
    isLive(ticket: RequestTicket): boolean {
      return ticket.seq === liveSeq;
    },
    invalidate(): void {
      liveSeq += 1;
    },
  };
}

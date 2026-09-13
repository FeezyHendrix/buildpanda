import type { InspectionReport } from "./project-types";

/**
 * A hold point is a contractual stop: the work it is placed on must not proceed
 * past it until the inspection passes. It therefore has to be visible on the
 * work it gates — the activity row, the look-ahead item — and not only on the
 * inspections page, where the person about to build the thing never looks.
 */
export function isOpenHoldPoint(inspection: InspectionReport): boolean {
  if (!inspection.holdPoint) return false;
  if (inspection.serviceStatus === "Cancelled") return false;
  return inspection.outcome !== "pass";
}

/**
 * Activity id -> the title of the hold-point inspection still gating it. An
 * activity with several open hold points shows the earliest scheduled one.
 */
export function openHoldPointsByActivity(
  inspections: readonly InspectionReport[],
): ReadonlyMap<string, string> {
  const byActivity = new Map<string, InspectionReport>();
  for (const inspection of inspections) {
    if (!inspection.activityId || !isOpenHoldPoint(inspection)) continue;
    const current = byActivity.get(inspection.activityId);
    if (!current || inspection.scheduledAt < current.scheduledAt) {
      byActivity.set(inspection.activityId, inspection);
    }
  }
  return new Map([...byActivity].map(([id, inspection]) => [id, inspection.title]));
}

/** "Hold point — formation approval not passed". */
export function holdPointLabel(inspectionTitle: string): string {
  return `Hold point — ${inspectionTitle} not passed`;
}

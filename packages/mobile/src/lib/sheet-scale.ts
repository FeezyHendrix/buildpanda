import type { SheetScale } from "@/components/plan-review/markup-types";
import { storage } from "./storage";

/**
 * A sheet's calibrated scale, per document revision, on this device.
 *
 * Calibration is a reading aid: it turns a measure line into a length for the
 * person holding the tablet. It is not a project record, so it lives in the
 * same key/value store as the session rather than in a synced table — and,
 * like the query cache, it is namespaced by user so two people sharing a site
 * tablet never read each other's calibration.
 */
const PREFIX = "buildpanda_sheet_scale";

function key(ownerId: string | undefined, documentVersionId: string): string {
  return `${PREFIX}_${ownerId ?? "anon"}_${documentVersionId}`;
}

export function readSheetScale(ownerId: string | undefined, documentVersionId: string): SheetScale | null {
  try {
    const raw = storage.getItem(key(ownerId, documentVersionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SheetScale>;
    if (typeof parsed.metresPerPct !== "number" || !(parsed.metresPerPct > 0)) return null;
    return { metresPerPct: parsed.metresPerPct, calibratedAt: parsed.calibratedAt ?? 0 };
  } catch {
    return null;
  }
}

export function writeSheetScale(ownerId: string | undefined, documentVersionId: string, scale: SheetScale): void {
  storage.setItem(key(ownerId, documentVersionId), JSON.stringify(scale));
}

export function clearSheetScale(ownerId: string | undefined, documentVersionId: string): void {
  storage.removeItem(key(ownerId, documentVersionId));
}

import { useCallback, useEffect, useState } from "react";
import { metresPerPctFromLine } from "@/components/plan-review/markup-shapes";
import type { MarkupPoint, SheetScale } from "@/components/plan-review/markup-types";
import { clearSheetScale, readSheetScale, writeSheetScale } from "@/lib/sheet-scale";

/**
 * The calibrated scale of the sheet revision on screen, read from the device
 * store when the revision changes and written back when a user sets it off a
 * drawn line. Mirrors the web's useSheetScale, keyed by revision rather than
 * sheet so a re-issued drawing never inherits the old sheet's calibration.
 */
export function useSheetScale(ownerId: string | undefined, documentVersionId: string | null) {
  const [scale, setScale] = useState<SheetScale | null>(null);

  useEffect(() => {
    setScale(documentVersionId ? readSheetScale(ownerId, documentVersionId) : null);
  }, [ownerId, documentVersionId]);

  /** Derive and store the scale from a line of a known real length; false if the line cannot carry one. */
  const setFromLine = useCallback(
    (a: MarkupPoint, b: MarkupPoint, aspect: number, metres: number): boolean => {
      if (!documentVersionId) return false;
      const metresPerPct = metresPerPctFromLine(a, b, aspect, metres);
      if (metresPerPct === null) return false;
      const next: SheetScale = { metresPerPct, calibratedAt: Date.now() };
      writeSheetScale(ownerId, documentVersionId, next);
      setScale(next);
      return true;
    },
    [ownerId, documentVersionId],
  );

  const clear = useCallback(() => {
    if (documentVersionId) clearSheetScale(ownerId, documentVersionId);
    setScale(null);
  }, [ownerId, documentVersionId]);

  return { scale, setFromLine, clear };
}

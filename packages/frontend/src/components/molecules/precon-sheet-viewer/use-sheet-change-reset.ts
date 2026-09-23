import { useState } from "react";

/**
 * Runs `reset` synchronously during the render in which the active sheet
 * changed — the render-time-adjust pattern, so a half-drawn shape from the old
 * sheet never paints on the new one. User-driven switches are guarded by the
 * discard prompt before ever reaching here; this reconciles external changes.
 */
export function useSheetChangeReset(activeSheetId: string | null, reset: () => void) {
  const [seenSheetId, setSeenSheetId] = useState(activeSheetId);
  if (seenSheetId !== activeSheetId) {
    setSeenSheetId(activeSheetId);
    reset();
  }
}

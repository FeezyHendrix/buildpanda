import type { PreconBoqRow, PreconSheet } from "@/api/precon";
import { PICTURE_PLAN, type PreconTool, type PreconToolMeta } from "@/lib/precon-meta";

/** Toggles and holds that need no sheet, scale or line. */
const ALWAYS_ON = new Set<PreconTool>(["select", "legend", "magnifier", "overlay"]);
/** Tools that give a sheet its scale, so they cannot need one. */
const SCALE_TOOLS = new Set<PreconTool>(["scale", "viewports"]);
/** Tools that read the drawing's own geometry, which a photograph does not have. */
const VECTOR_TOOLS = new Set<PreconTool>(["room_fill", "find_symbol"]);

/**
 * Why a tool cannot be used right now, or null. Tools are disabled with the
 * reason in their tooltip, never hidden (brief section 07).
 */
export function blockedReasonFor(meta: PreconToolMeta, activeSheet: PreconSheet | null, selectedRow: PreconBoqRow | null): string | null {
  if (ALWAYS_ON.has(meta.key)) return null;
  if (!activeSheet) return "Open a sheet first";
  if (SCALE_TOOLS.has(meta.key)) return null;
  if (VECTOR_TOOLS.has(meta.key) && PICTURE_PLAN.test(activeSheet.fileName)) return "Needs a vector drawing (PDF or DWG), not a picture";
  if (!activeSheet.scaleMmPerPt) return "Set this sheet's scale first (S, or Sheet settings)";
  if (meta.needsLine && !selectedRow) return "Select a bill line first";
  return null;
}

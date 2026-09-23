import { Button } from "@/components/atoms/button";
import { keptWithManual } from "./detection-model";
import type { useDetectionTools } from "./use-detection-tools";

const BAR = "flex flex-wrap items-center gap-2 border-b px-3 py-1.5 text-xs";
const LINK = "underline";

interface Props {
  detect: ReturnType<typeof useDetectionTools>;
}

/**
 * The correction strips for Room fill and Find symbol: a detected room's
 * Accept / repair hint / Cancel, the template's explicit Search, the match
 * review's keep/reject/add controls, and the duplicate warning that stands
 * between a rerun and a double-counted line. All plain buttons — no hidden
 * gestures.
 */
export function DetectionBanners({ detect }: Props) {
  if (detect.duplicates && detect.review) {
    const total = keptWithManual(detect.review).length;
    return (
      <div className={`${BAR} border-amber-200 bg-amber-50 text-amber-900`} data-duplicate-warning>
        <span>
          <span className="font-semibold">{detect.duplicates.existingCount}</span> of {total} marker{total === 1 ? "" : "s"} sit on already-counted markers of this sheet — counting them again would double the line.
        </span>
        <Button size="sm" onClick={detect.dropDuplicatesAndConfirm}>
          Drop duplicates, count the rest
        </Button>
        <Button size="sm" variant="secondary" onClick={detect.overrideDuplicatesAndConfirm}>
          Keep anyway (deliberate)
        </Button>
        <button type="button" className={LINK} onClick={detect.discardReview}>
          Discard
        </button>
      </div>
    );
  }
  if (detect.review) {
    const kept = keptWithManual(detect.review).length;
    return (
      <div className={`${BAR} border-primary-100 bg-primary-50 text-primary-800`} data-symbol-review>
        <span>
          <span className="font-semibold">{kept}</span> marker{kept === 1 ? "" : "s"} of {detect.review.name ?? "the symbol"} — click a pin to reject or keep it
        </span>
        <Button size="sm" variant="secondary" onClick={() => detect.stepMatch(-1)} aria-label="Previous match">
          ← Prev
        </Button>
        <Button size="sm" variant="secondary" onClick={() => detect.stepMatch(1)} aria-label="Next match">
          Next →
        </Button>
        <Button size="sm" variant="secondary" onClick={detect.rejectAll}>
          Reject all
        </Button>
        <Button size="sm" variant={detect.review.addingMissed ? "primary" : "secondary"} aria-pressed={detect.review.addingMissed} onClick={detect.toggleAddMissed}>
          {detect.review.addingMissed ? "Adding missed — click the sheet" : "Add missed markers"}
        </Button>
        <Button size="sm" disabled={kept === 0} onClick={detect.confirmCount}>
          Count {kept}
        </Button>
        <button type="button" className={LINK} onClick={detect.discardReview}>
          Discard
        </button>
      </div>
    );
  }
  if (detect.template) {
    return (
      <div className={`${BAR} border-amber-100 bg-amber-50 text-amber-900`} data-symbol-template-banner>
        <span>Search the whole sheet for symbols matching the boxed template?</span>
        <Button size="sm" loading={detect.searching} onClick={detect.searchTemplate}>
          Search sheet
        </Button>
        <Button size="sm" variant="secondary" onClick={detect.cancelTemplate}>
          Cancel
        </Button>
      </div>
    );
  }
  if (detect.room) {
    return (
      <div className={`${BAR} border-emerald-200 bg-emerald-50 text-emerald-900`} data-room-preview-banner>
        <span>
          Found <span className="font-semibold">{detect.room.label ?? "an enclosed space"}</span> · ≈{detect.room.areaM2} m². Drag a corner to repair the boundary — nothing is saved yet.
        </span>
        <Button size="sm" onClick={detect.roomAccept}>
          Accept room
        </Button>
        <button type="button" className={LINK} onClick={detect.roomCancel}>
          Cancel
        </button>
      </div>
    );
  }
  return null;
}
DetectionBanners.displayName = "DetectionBanners";

/** Under a "no enclosed space" answer: the explicit path to draw it by hand. */
export function AreaFallbackAction({ visible, onDrawArea }: { visible: boolean; onDrawArea: () => void }) {
  if (!visible) return null;
  return (
    <div className={`${BAR} border-amber-100 bg-amber-50 text-amber-900`} data-area-fallback>
      <span>No enclosed space was found at that point.</span>
      <Button size="sm" onClick={onDrawArea}>
        Draw with Area
      </Button>
    </div>
  );
}
AreaFallbackAction.displayName = "AreaFallbackAction";

import { Check, EyeOff } from "lucide-react";
import { formatClock, type Sheet } from "./plan-review-data";
import { BLEND_MODES, REC_STATUS, TOOLS, sheetAt } from "./plan-review-types";
import type { MarkupToolsController } from "./use-markup-tools";
import type { RecordingController } from "./use-plan-recording";
import type { SheetNavigationController } from "./use-sheet-navigation";

interface SaveState {
  /** False for demo sheets, which have no document to write markup against. */
  canPersist: boolean;
  isSaving: boolean;
  hasError: boolean;
  markupLoading: boolean;
}

function describeSaveState(save: SaveState, recording: RecordingController): string {
  if (recording.status === REC_STATUS.RECORDING) return `Recording walkthrough · ${formatClock(recording.seconds)}`;
  if (recording.savedFlash) return "Walkthrough saved";
  if (save.hasError) return "Could not save — retry";
  if (save.isSaving) return "Saving…";
  if (!save.canPersist) return "Demo sheet — markup not saved";
  if (save.markupLoading) return "Loading markup…";
  return "All changes saved";
}

function describeContext(sheets: Sheet[], sheet: Sheet | null, nav: SheetNavigationController): string {
  if (nav.split.open) {
    return `Comparing ${sheetAt(sheets, nav.split.primaryIndex).code} / ${sheetAt(sheets, nav.split.compareIndex).code}`;
  }
  if (!sheet) return "No sheets";
  const blend =
    nav.blendPanelOpen && nav.blendMode
      ? ` · ${BLEND_MODES.find((m) => m.id === nav.blendMode)?.label} · ${nav.blendAmount}%`
      : "";
  return `Sheet ${sheet.code}${blend}`;
}

interface PlanReviewStatusBarProps {
  sheets: Sheet[];
  sheet: Sheet | null;
  nav: SheetNavigationController;
  markup: MarkupToolsController;
  recording: RecordingController;
  save: SaveState;
}

/** Footer ledger: whether the work is saved, what is on screen, and the tool in hand. */
export function PlanReviewStatusBar({ sheets, sheet, nav, markup, recording, save }: PlanReviewStatusBarProps) {
  const activeToolLabel = TOOLS.find((t) => t.id === markup.activeTool)?.label ?? "Select";
  return (
    <footer
      role="status"
      aria-live="polite"
      className="flex shrink-0 items-center gap-3 border-t border-[#F0F0F0] bg-white px-3 py-1.5 text-[11px] text-gray-500"
    >
      <span className="flex items-center gap-1.5">
        {recording.status === REC_STATUS.RECORDING ? (
          <span className="size-2 animate-pulse rounded-full bg-red-500" />
        ) : (
          <Check size={12} className="text-green-600" />
        )}
        {describeSaveState(save, recording)}
      </span>
      <span className="mx-auto truncate text-gray-700">{describeContext(sheets, sheet, nav)}</span>
      <span className="flex shrink-0 items-center gap-2">
        Tool: {activeToolLabel}
        {!markup.markupVisible && <span className="flex items-center gap-1 text-amber-600"><EyeOff size={11} /> Markup hidden</span>}
      </span>
    </footer>
  );
}

PlanReviewStatusBar.displayName = "PlanReviewStatusBar";

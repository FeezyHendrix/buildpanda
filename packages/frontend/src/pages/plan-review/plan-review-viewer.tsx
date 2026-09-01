import { ChevronLeft, ChevronRight, Square } from "lucide-react";
import { BlendComparisonPanel } from "./plan-review-blend-panel";
import { CommentComposerPopover } from "./plan-review-comment";
import type { CommentAssignee, CommentCapture } from "./plan-review-comment-types";
import { SHEET_KIND, formatClock, type Sheet } from "./plan-review-data";
import { PlanReviewSplit } from "./plan-review-split";
import { PlanReviewStage } from "./plan-review-stage";
import { REC_STATUS, SELECTION_KIND, type PopoverId } from "./plan-review-types";
import { IconBtn } from "./plan-review-ui";
import type { CommentAnchor, MarkupToolsController } from "./use-markup-tools";
import type { RecordingController } from "./use-plan-recording";
import type { SheetNavigationController } from "./use-sheet-navigation";
import type { SheetScaleController } from "./use-sheet-scale";

interface ViewerComment {
  anchor: CommentAnchor | null;
  assignees: CommentAssignee[];
  projectId: string | undefined;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (capture: CommentCapture) => void;
}

interface PlanReviewViewerProps {
  sheet: Sheet;
  sheets: Sheet[];
  compareSheet: Sheet | null;
  currentRevision: string;
  canCompare: boolean;
  nav: SheetNavigationController;
  markup: MarkupToolsController;
  scale: SheetScaleController;
  recording: RecordingController;
  drawingRef: React.RefObject<HTMLDivElement | null>;
  popover: { open: PopoverId | null; onOpen: (id: PopoverId | null) => void };
  comment: ViewerComment;
}

/**
 * The viewer pane: one sheet or a split compare, with the controls that belong
 * to the viewport rather than the drawing — the revision blend panel, the
 * recording stop button, the PDF page switcher and the comment composer.
 */
export function PlanReviewViewer({
  sheet,
  sheets,
  compareSheet,
  currentRevision,
  canCompare,
  nav,
  markup,
  scale,
  recording,
  drawingRef,
  popover,
  comment,
}: PlanReviewViewerProps) {
  const blendReady =
    nav.blendPanelOpen &&
    nav.blendMode &&
    canCompare &&
    sheet.kind === SHEET_KIND.IMAGE &&
    compareSheet?.kind === SHEET_KIND.IMAGE;

  function submitCalibration(): void {
    const selection = markup.selection;
    if (selection?.kind !== SELECTION_KIND.MARKUP) return;
    scale.calibrate(sheet.id, markup.markups.find((m) => m.id === selection.id) ?? null);
  }

  return (
    <section className="relative flex min-h-0 min-w-0 flex-[2] flex-col overflow-hidden">
      {!nav.split.open ? (
        <PlanReviewStage
          sheet={sheet}
          blend={{ ready: Boolean(blendReady), compareSheet, currentRevision }}
          nav={nav}
          markup={markup}
          scale={scale}
          recording={recording}
          drawingRef={drawingRef}
          onCalibrate={submitCalibration}
        />
      ) : (
        <PlanReviewSplit sheets={sheets} nav={nav} popover={popover} />
      )}

      {/* ── Blend comparison panel ── */}
      {nav.blendPanelOpen && !nav.split.open && (
        <BlendComparisonPanel
          blendMode={nav.blendMode}
          amount={nav.blendAmount}
          sheets={sheets}
          sheetCode={sheet.code}
          revision={currentRevision}
          compareIndex={nav.compareSheetIndex}
          blendReady={Boolean(blendReady)}
          onModeChange={nav.setBlendMode}
          onAmountChange={nav.setBlendAmount}
          onCompareIndexChange={nav.setCompareSheetIndex}
          onReset={() => nav.setBlendAmount(50)}
          onOpenSplit={() => nav.setSplit((s) => ({ ...s, open: true }))}
          onClose={() => {
            nav.setBlendPanelOpen(false);
            nav.setBlendMode(null);
          }}
        />
      )}

      {recording.status === REC_STATUS.RECORDING && (
        <button
          type="button"
          aria-label="Stop recording"
          title="Stop recording"
          onClick={recording.stop}
          className="absolute bottom-16 right-4 z-30 flex items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xl hover:bg-red-500"
        >
          <span className="size-2 animate-pulse rounded-full bg-white" />
          <Square size={13} fill="currentColor" /> Stop · {formatClock(recording.seconds)}
        </button>
      )}

      {/* ── Page switcher — fixed to the viewer, never inside the pan/zoom surface ── */}
      {nav.pdfPageCount > 1 && !nav.split.open && (
        <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 rounded-full bg-white/95 p-1 shadow-xl ring-1 ring-black/5">
          <IconBtn
            label="Previous page"
            disabled={nav.pdfPage <= 1}
            onClick={() => nav.setPdfPage((p) => Math.max(1, p - 1))}
            className="size-8"
          >
            <ChevronLeft size={15} />
          </IconBtn>
          <span className="min-w-16 text-center font-mono text-xs text-gray-700">
            {nav.pdfPage} / {nav.pdfPageCount}
          </span>
          <IconBtn
            label="Next page"
            disabled={nav.pdfPage >= nav.pdfPageCount}
            onClick={() => nav.setPdfPage((p) => Math.min(nav.pdfPageCount, p + 1))}
            className="size-8"
          >
            <ChevronRight size={15} />
          </IconBtn>
        </div>
      )}

      {comment.anchor && (
        <CommentComposerPopover
          anchor={{ x: comment.anchor.x, y: comment.anchor.y }}
          assignees={comment.assignees}
          color={markup.markupColor}
          projectId={comment.projectId}
          busy={comment.busy}
          onCancel={comment.onCancel}
          onSubmit={comment.onSubmit}
        />
      )}
    </section>
  );
}

PlanReviewViewer.displayName = "PlanReviewViewer";

import { MarkupThreadPopover } from "@/components/molecules/markup-thread/markup-thread-popover";
import type { CommentAssignee, CommentCapture } from "@/lib/markup-meta";
import { CommentComposerPopover } from "./plan-review-comment";
import type { Sheet } from "./plan-review-data";
import { PlanReviewSplit } from "./plan-review-split";
import { PlanReviewStage } from "./plan-review-stage";
import { SELECTION_KIND } from "./plan-review-types";
import type { CommentAnchor, MarkupToolsController } from "./use-markup-tools";
import type { MarkupThreadController } from "./use-markup-thread";
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
  nav: SheetNavigationController;
  markup: MarkupToolsController;
  scale: SheetScaleController;
  drawingRef: React.RefObject<HTMLDivElement | null>;
  comment: ViewerComment;
  thread: MarkupThreadController;
}

export function PlanReviewViewer({
  sheet,
  sheets,
  nav,
  markup,
  scale,
  drawingRef,
  comment,
  thread,
}: PlanReviewViewerProps) {
  const threadMarkup = thread.target ? markup.serverMarkups.get(thread.target.id) : null;
  function submitCalibration(): void {
    const selection = markup.selection;
    if (selection?.kind !== SELECTION_KIND.MARKUP) return;
    scale.calibrate(sheet.id, markup.sheetMarkups.find((item) => item.id === selection.id) ?? null);
  }
  if (nav.comparing && sheets.length > 1)
    return <PlanReviewSplit sheets={sheets} activeIndex={sheets.indexOf(sheet)} />;
  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PlanReviewStage
        sheet={sheet}
        nav={nav}
        markup={markup}
        scale={scale}
        drawingRef={drawingRef}
        onCalibrate={submitCalibration}
      />
      {thread.target && threadMarkup ? (
        <MarkupThreadPopover
          anchor={thread.target.anchor}
          markup={threadMarkup}
          subtitle={`${sheet.code} · ${threadMarkup.revisionLabel ?? sheet.revision}`}
          canEdit={thread.canEdit}
          actions={thread.actions}
          assignees={thread.assignees}
          links={thread.linksFor(threadMarkup)}
          onClose={() => thread.setTarget(null)}
        />
      ) : null}
      {comment.anchor ? (
        <CommentComposerPopover
          anchor={{ x: comment.anchor.x, y: comment.anchor.y }}
          assignees={comment.assignees}
          color={markup.markupColor}
          projectId={comment.projectId}
          busy={comment.busy}
          onCancel={comment.onCancel}
          onSubmit={comment.onSubmit}
        />
      ) : null}
    </section>
  );
}
PlanReviewViewer.displayName = "PlanReviewViewer";

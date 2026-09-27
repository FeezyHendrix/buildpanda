import { Button } from "@/components/atoms/button";
import { PlanReviewViewer } from "./plan-review-viewer";
import { PlanReviewStatusBar } from "./plan-review-status-bar";
import type { ReviewPane } from "./use-review-pane";

/** The same editable canvas is used alone and in both comparison panes. */
export function SheetPane({ review, label }: { review: ReviewPane; label?: string }) {
  if (!review.sheet) return null;
  return (
    <>
      {review.markupQuery.isError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-2 text-sm text-red-600"
        >
          Could not load annotations.
          <Button
            variant="ghost"
            size="sm"
            loading={review.markupQuery.isFetching}
            onClick={() => void review.markupQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : null}
      <PlanReviewViewer
        sheet={review.sheet}
        nav={review.nav}
        markup={review.markup}
        scale={review.scale}
        drawingRef={review.drawingRef}
        thread={review.thread}
        comment={review.comment}
        label={label}
      />
      <PlanReviewStatusBar save={review.save} />
    </>
  );
}
SheetPane.displayName = "SheetPane";

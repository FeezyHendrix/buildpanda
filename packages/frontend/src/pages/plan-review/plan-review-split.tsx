import { useState } from "react";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";
import { SheetPane } from "./plan-review-sheet-pane";
import { useReviewPane, type ReviewPaneContext } from "./use-review-pane";

type PaneSide = "Left" | "Right";
interface ComparisonPaneProps {
  context: ReviewPaneContext;
  initialIndex: number;
  label: PaneSide;
  active: boolean;
  onActivate: () => void;
}
function ComparisonPane({ context, initialIndex, label, active, onActivate }: ComparisonPaneProps) {
  const review = useReviewPane(context, initialIndex, active);
  if (!review.sheet) return null;
  return (
    <section
      aria-label={`${label} plan`}
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-white",
        active ? "border-primary-500" : "border-line",
      )}
    >
      <div className="flex items-center gap-2 border-b border-line-hair p-2">
        <label className="sr-only" htmlFor={`compare-${label}`}>
          {label} plan
        </label>
        <select
          id={`compare-${label}`}
          value={review.activeIndex}
          onChange={(event) => review.nav.goTo(Number(event.target.value))}
          className={cn(INPUT_SM_CLASS, "min-w-0 flex-1")}
        >
          {context.sheets.map((item, i) => (
            <option key={item.id} value={i}>
              {item.code} · {item.title}
            </option>
          ))}
        </select>
        <span className="shrink-0 text-xs text-gray-500">{review.sheet.revision}</span>
      </div>
      <SheetPane review={review} label={label} />
    </section>
  );
}
ComparisonPane.displayName = "ComparisonPane";

/** Shared tools, independent document/page anchors, and only one active thread. */
export function PlanReviewSplit({ context, activeIndex }: { context: ReviewPaneContext; activeIndex: number }) {
  const [activePane, setActivePane] = useState<PaneSide>("Left");
  return (
    <div className="grid min-h-0 flex-1 grid-rows-2 gap-3 bg-gray-100 p-3 md:grid-cols-2 md:grid-rows-1">
      <ComparisonPane
        context={context}
        initialIndex={activeIndex}
        label="Left"
        active={activePane === "Left"}
        onActivate={() => setActivePane("Left")}
      />
      <ComparisonPane
        context={context}
        initialIndex={(activeIndex + 1) % context.sheets.length}
        label="Right"
        active={activePane === "Right"}
        onActivate={() => setActivePane("Right")}
      />
    </div>
  );
}
PlanReviewSplit.displayName = "PlanReviewSplit";

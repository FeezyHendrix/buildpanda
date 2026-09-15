import { useState } from "react";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";
import type { Sheet } from "./plan-review-data";
import { SheetPane } from "./plan-review-sheet-pane";
import { sheetAt } from "./plan-review-types";

function ComparisonPane({ sheets, initialIndex, label }: { sheets: Sheet[]; initialIndex: number; label: string }) {
  const [index, setIndex] = useState(initialIndex);
  const sheet = sheetAt(sheets, index);
  return (
    <section
      aria-label={`${label} plan`}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-white"
    >
      <div className="flex items-center gap-2 border-b border-line-hair p-2">
        <label className="sr-only" htmlFor={`compare-${label}`}>
          {label} plan
        </label>
        <select
          id={`compare-${label}`}
          value={sheets.indexOf(sheet)}
          onChange={(event) => setIndex(Number(event.target.value))}
          className={cn(INPUT_SM_CLASS, "min-w-0 flex-1")}
        >
          {sheets.map((item, i) => (
            <option key={item.id} value={i}>
              {item.code} · {item.title}
            </option>
          ))}
        </select>
        <span className="shrink-0 text-xs text-gray-500">{sheet.revision}</span>
      </div>
      <SheetPane key={sheet.id} sheet={sheet} label={label} />
    </section>
  );
}
ComparisonPane.displayName = "ComparisonPane";

/** One comparison mode that works with both PDF and image plans. */
export function PlanReviewSplit({ sheets, activeIndex }: { sheets: Sheet[]; activeIndex: number }) {
  return (
    <div className="grid min-h-0 flex-1 grid-rows-2 gap-3 bg-gray-100 p-3 md:grid-cols-2 md:grid-rows-1">
      <ComparisonPane sheets={sheets} initialIndex={activeIndex} label="Left" />
      <ComparisonPane sheets={sheets} initialIndex={(activeIndex + 1) % sheets.length} label="Right" />
    </div>
  );
}
PlanReviewSplit.displayName = "PlanReviewSplit";

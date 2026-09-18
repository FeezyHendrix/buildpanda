import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";
import type { Sheet } from "./plan-review-data";
import { sheetAt } from "./plan-review-types";

interface WorkspaceHeaderProps {
  sheets: Sheet[];
  activeIndex: number;
  comparing: boolean;
  onSelectSheet: (index: number) => void;
  onExit: () => void;
}

/** One sheet picker and the actual revision, with no simulated revision switch. */
export function WorkspaceHeader({ sheets, activeIndex, comparing, onSelectSheet, onExit }: WorkspaceHeaderProps) {
  const sheet = sheetAt(sheets, activeIndex);
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-line-hair bg-white px-3 py-2">
      <Button variant="ghost" size="sm" onClick={onExit} aria-label="Back to plans">
        <ArrowLeft size={16} /> <span className="hidden sm:inline">Plans</span>
      </Button>
      <FileText size={16} className="shrink-0 text-gray-400" />
      {comparing ? (
        <h1 className="text-sm font-semibold text-gray-900">Compare plans</h1>
      ) : (
        <>
          <label htmlFor="review-plan" className="sr-only">
            Plan
          </label>
          <select
            id="review-plan"
            value={activeIndex}
            onChange={(event) => onSelectSheet(Number(event.target.value))}
            className={cn(INPUT_SM_CLASS, "min-w-0 flex-1 sm:max-w-lg")}
          >
            {sheets.map((item, index) => (
              <option key={item.id} value={index}>
                {item.code} · {item.title}
              </option>
            ))}
          </select>
          <span className="ml-auto shrink-0 text-xs text-gray-500">{sheet.revision}</span>
        </>
      )}
    </header>
  );
}
WorkspaceHeader.displayName = "WorkspaceHeader";

import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/button";
import { DateInputField } from "@/components/molecules/date-input-field";
import { cn } from "@/lib/utils";
import { APPROVAL_FILTERS, type ApprovalFilter } from "./shared";

interface ApprovalsFilterPanelProps {
  status: ApprovalFilter;
  onStatusChange: (value: ApprovalFilter) => void;
  dateFrom: string;
  dateTo: string;
  onApplyDates: (from: string, to: string) => void;
  onReset: () => void;
}

const LABEL_CLASS = "text-caption-m! font-semibold text-[#1E1E1E]";

/**
 * Status pills apply as you pick them; the date range applies together on
 * "Apply Filter", which stays disabled until both dates are set.
 */
export function ApprovalsFilterPanel({ status, onStatusChange, dateFrom, dateTo, onApplyDates, onReset }: ApprovalsFilterPanelProps) {
  const [draftFrom, setDraftFrom] = useState(dateFrom);
  const [draftTo, setDraftTo] = useState(dateTo);

  useEffect(() => {
    setDraftFrom(dateFrom);
    setDraftTo(dateTo);
  }, [dateFrom, dateTo]);

  return (
    <aside aria-label="Filter approvals" className="border border-[#EBEBEB] bg-white p-5">
      <h2 className="text-h6 font-semibold text-[#1E1E1E]">Filter</h2>

      <div role="group" aria-label="Status" className="mt-5 flex flex-wrap gap-2">
        {APPROVAL_FILTERS.map((option) => {
          const on = option.value === status;
          return (
            <Button
              key={option.value}
              type="button"
              size='sm'
              variant='outline'
              aria-pressed={on}
              onClick={() => onStatusChange(option.value)}
              className={cn(
                "rounded-full border px-2.5 text-caption-m! font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
                on ? "border-primary bg-primary text-white" : "border-[#EBEBEB] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5]",
              )}
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-1.5">
        <label htmlFor="approvals-from" className={LABEL_CLASS}>From</label>
        <DateInputField id="approvals-from" value={draftFrom} onChange={setDraftFrom} />
      </div>
      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor="approvals-to" className={LABEL_CLASS}>To</label>
        <DateInputField id="approvals-to" value={draftTo} min={draftFrom || undefined} onChange={setDraftTo} />
      </div>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        disabled={!draftFrom || !draftTo}
        onClick={() => onApplyDates(draftFrom, draftTo)}
        className="mt-6 w-full"
      >
        Apply Filter
      </Button>
      <Button type="button" variant="ghost" size="lg" onClick={onReset} className="mt-1 w-full">
        Reset
      </Button>
    </aside>
  );
}

ApprovalsFilterPanel.displayName = "ApprovalsFilterPanel";

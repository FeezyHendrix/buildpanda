import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Select } from "@/components/atoms/select";
import { DateInputField } from "@/components/molecules/date-input-field";
import type { RfiPriority } from "@/lib/project-types";
import { NO_RFI_FILTERS, PRIORITY_OPTIONS, type RfiFilterValues } from "./shared";

const LABEL_CLASS = "text-[12px] font-semibold leading-[16px] text-[#1E1E1E]";
const FIELD_CLASS = "h-[45px] border border-[#EEEEEE] px-4 text-[14px] placeholder:text-[#A5A5A5]";

/** Keyword search above a Priority / due-date filter that is applied with its own button. */
export function RfiFilterPanel({
  search,
  onSearchChange,
  applied,
  onApply,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  applied: RfiFilterValues;
  onApply: (values: RfiFilterValues) => void;
}) {
  const [draft, setDraft] = useState<RfiFilterValues>(applied);

  // Nothing to apply until a priority or a date (or both) has been chosen.
  const hasChoice = Boolean(draft.priority || draft.dueFrom || draft.dueTo);

  function reset(): void {
    setDraft(NO_RFI_FILTERS);
    onApply(NO_RFI_FILTERS);
  }

  return (
    <aside aria-label="Search and filter RFIs" className="flex flex-col gap-[16px]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-[15px] top-1/2 size-[16px] -translate-y-1/2 text-[#1E1E1E]" strokeWidth={1.5} />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search Keyword"
          aria-label="Search RFIs"
          className="h-[45px] w-full appearance-none border border-[#EEEEEE] bg-white pl-[44px] pr-[16px] text-[14px] text-[#1E1E1E] outline-none placeholder:text-[#A5A5A5] focus:border-primary [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onApply(draft);
        }}
        className="border border-[#EEEEEE] bg-white p-[20px] pb-[12px]"
      >
        <h2 className="text-[16px] font-semibold leading-[24px] text-[#111111]">Filter</h2>

        <div className="mt-[22px] flex flex-col gap-[15px]">
          <div className="flex flex-col gap-[5px]">
            <label htmlFor="rfi-priority" className={LABEL_CLASS}>Priority</label>
            <Select
              id="rfi-priority"
              options={PRIORITY_OPTIONS}
              value={draft.priority}
              onChange={(next) => setDraft((d) => ({ ...d, priority: next as RfiPriority | null }))}
              placeholder="Select a priority"
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-[5px]">
            <label htmlFor="rfi-from" className={LABEL_CLASS}>From</label>
            <DateInputField
              id="rfi-from"
              value={draft.dueFrom}
              onChange={(value) => setDraft((d) => ({ ...d, dueFrom: value }))}
              max={draft.dueTo || undefined}
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-[5px]">
            <label htmlFor="rfi-to" className={LABEL_CLASS}>To</label>
            <DateInputField
              id="rfi-to"
              value={draft.dueTo}
              onChange={(value) => setDraft((d) => ({ ...d, dueTo: value }))}
              min={draft.dueFrom || undefined}
              className={FIELD_CLASS}
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="ghost"
          size="lg"
          disabled={!hasChoice}
          className="mt-[24px] w-full bg-[#F5F5F5] text-[#1E1E1E] hover:bg-[#EDEDED]"
        >
          Apply Filter
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={reset} className="w-full text-[#1E1E1E]">
          Reset
        </Button>
      </form>
    </aside>
  );
}

RfiFilterPanel.displayName = "RfiFilterPanel";

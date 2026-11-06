import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Select } from "@/components/atoms/select";
import { UnitInputField } from "@/components/molecules/unit-input-field";
import { cn } from "@/lib/utils";
import {
  CURRENCY_OPTIONS,
  STATUS_FILTERS,
  TYPE_OPTIONS,
  hasAppliedFilters,
  noChangeFilters,
  type ChangeFilterValues,
  type StatusFilter,
} from "./shared";
import type { ChangeTypeFilter } from "./time-claim-position";

const LABEL_CLASS = "text-[12px] font-semibold leading-[16px] text-[#1E1E1E]";
const FIELD_CLASS = "h-[44px] border border-[#EEEEEE] px-4 text-[14px]";
const HEADING_CLASS = "text-[16px] font-semibold leading-[24px] text-[#111111]";

function StatusPills({ value, onChange }: { value: StatusFilter; onChange: (value: StatusFilter) => void }) {
  return (
    <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-[8px]">
      {STATUS_FILTERS.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              "h-[24px] rounded-full border px-[8px] text-[12px] font-medium leading-[16px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
              selected ? "border-primary bg-primary text-white" : "border-[#EEEEEE] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5]",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Status pills apply at once; the cost range and type wait for Apply Filter. */
export function ChangeFilterPanel({
  status,
  onStatusChange,
  applied,
  onApply,
  onReset,
  defaultCurrency,
}: {
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  applied: ChangeFilterValues;
  onApply: (values: ChangeFilterValues) => void;
  onReset: () => void;
  defaultCurrency: string;
}) {
  const [draft, setDraft] = useState<ChangeFilterValues>(applied);
  // Nothing to apply until a cost bound or a type has been chosen.
  const hasChoice = hasAppliedFilters(draft);

  function reset(): void {
    setDraft(noChangeFilters(defaultCurrency));
    onReset();
  }

  return (
    <aside aria-label="Filter change requests">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onApply(draft);
        }}
        className="border border-[#EEEEEE] bg-white p-[20px] pb-[12px]"
      >
        <h2 className={HEADING_CLASS}>Filter</h2>
        <div className="mt-[23px]">
          <StatusPills value={status} onChange={onStatusChange} />
        </div>

        <div className="mt-[17px] border-t border-[#EEEEEE] pt-[14px]">
          <h3 className={HEADING_CLASS}>Cost Change</h3>
          <div className="mt-[6px] flex flex-col gap-[17px]">
            <UnitInputField
              id="change-cost-from"
              label="From"
              unitOptions={CURRENCY_OPTIONS}
              unit={draft.currency}
              onUnitChange={(currency) => setDraft((d) => ({ ...d, currency }))}
              value={draft.costFrom}
              onChange={(costFrom) => setDraft((d) => ({ ...d, costFrom }))}
              placeholder="Enter Amount"
              heightClass="h-[44px]"
            />
            <UnitInputField
              id="change-cost-to"
              label="To"
              unitOptions={CURRENCY_OPTIONS}
              unit={draft.currency}
              onUnitChange={(currency) => setDraft((d) => ({ ...d, currency }))}
              value={draft.costTo}
              onChange={(costTo) => setDraft((d) => ({ ...d, costTo }))}
              placeholder="Enter Amount"
              heightClass="h-[44px]"
            />
            <div className="flex flex-col gap-[5px]">
              <label htmlFor="change-type" className={LABEL_CLASS}>Type</label>
              <Select
                id="change-type"
                options={TYPE_OPTIONS}
                value={draft.type}
                onChange={(next) => setDraft((d) => ({ ...d, type: (next ?? "all") as ChangeTypeFilter }))}
                className={FIELD_CLASS}
              />
            </div>
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

ChangeFilterPanel.displayName = "ChangeFilterPanel";

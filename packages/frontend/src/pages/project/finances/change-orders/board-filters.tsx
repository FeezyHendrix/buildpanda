import { Select } from "@/components/atoms/select";
import { cn } from "@/lib/utils";
import type { ChangeStatus } from "@/lib/project-types";
import { BOARD_COLUMNS, TYPE_PILLS, type TypePill } from "./change-order-model";

export type StatusPill = ChangeStatus | "all";

const STATUS_PILLS: readonly { value: StatusPill; label: string }[] = [{ value: "all", label: "All" }, ...BOARD_COLUMNS.map((c) => ({ value: c.status, label: c.label }))];
const TYPE_OPTIONS = TYPE_PILLS.map((pill) => ({ value: pill.value, label: pill.label }));

interface BoardFiltersProps {
  status: StatusPill;
  onStatusChange: (next: StatusPill) => void;
  type: TypePill;
  onTypeChange: (next: TypePill) => void;
}

/**
 * Status pills narrow the board to one column ("All" shows the whole ladder).
 * The kind of change (variation, omission, time claim, provisional sum) is a
 * dropdown on the right, so it stays filterable without a second row of pills.
 */
export function BoardFilters({ status, onStatusChange, type, onTypeChange }: BoardFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-[12px]">
      <div role="tablist" aria-label="Change order status" className="flex flex-wrap gap-[8px]">
        {STATUS_PILLS.map((pill) => {
          const selected = pill.value === status;
          return (
            <button
              key={pill.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onStatusChange(pill.value)}
              className={cn(
                "h-[36px] rounded-full border px-[16px] text-caption-l font-medium outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-[#004DE7]/25",
                selected ? "border-[#1E1E1E] bg-[#1E1E1E] text-white" : "border-[#EEEEEE] bg-white text-[#1E1E1E] hover:bg-[#F6F6F6]",
              )}
            >
              {pill.label}
            </button>
          );
        })}
      </div>
      <div className="w-[180px]">
        <Select
          options={TYPE_OPTIONS}
          value={type}
          onChange={(next) => onTypeChange((next ?? "all") as TypePill)}
          className="h-[36px] border-[#EEEEEE] px-[12px] text-[14px] font-medium"
          iconClassName="size-4 text-[#1E1E1E]"
          popupClassName="min-w-[200px]"
        />
      </div>
    </div>
  );
}

BoardFilters.displayName = "BoardFilters";

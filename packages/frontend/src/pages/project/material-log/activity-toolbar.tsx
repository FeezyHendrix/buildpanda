import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu";
import { DateFilterPopover } from "@/components/molecules/date-filter-popover";
import { ToolbarSearch } from "@/components/molecules/toolbar-search";
import { LEDGER_FILTERS, type LedgerFilter } from "./shared";

const FILTER_BUTTON_CLASS =
  "inline-flex h-10 items-center gap-2 border border-[#EBEBEB] bg-white px-3 text-sm font-medium text-[#1E1E1E] outline-none hover:bg-[#F5F5F5] focus-visible:ring-2 focus-visible:ring-gray-900/10";

interface ActivityToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  /** `yyyy-mm-dd`, or "" for open-ended. */
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
  status: LedgerFilter;
  onStatusChange: (value: LedgerFilter) => void;
}

/** Search on the left; the date range and status filters on the right. */
export function ActivityToolbar({
  search,
  onSearchChange,
  dateFrom,
  dateTo,
  onDateChange,
  status,
  onStatusChange,
}: ActivityToolbarProps) {
  const activeStatus = LEDGER_FILTERS.find((f) => f.value === status);

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <ToolbarSearch
        value={search}
        onChange={onSearchChange}
        placeholder="Search Material Log"
        ariaLabel="Search material log"
      />

      <div className="flex flex-wrap items-center gap-2">
        <DateFilterPopover dateFrom={dateFrom} dateTo={dateTo} onApply={onDateChange} />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" aria-label="Filter by status" className={FILTER_BUTTON_CLASS}>
                {status === "all" ? "Status" : activeStatus?.label}
                <ChevronDown className="size-4" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-[180px]">
            {LEDGER_FILTERS.map((option) => (
              <DropdownMenuItem key={option.value} onSelect={() => onStatusChange(option.value)}>
                <span className={option.value === status ? "font-semibold" : undefined}>{option.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

ActivityToolbar.displayName = "ActivityToolbar";

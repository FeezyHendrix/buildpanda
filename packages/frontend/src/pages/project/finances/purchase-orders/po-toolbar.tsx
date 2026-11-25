import { Download } from "lucide-react";
import { SearchInput } from "@/components/atoms/search-input";
import { DateFilterPopover } from "@/components/molecules/date-filter-popover";

interface PoToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
  onExport: () => void;
  canExport: boolean;
}

/** Search on the left; the expected-date range and a CSV download on the right. */
export function PoToolbar({ search, onSearchChange, dateFrom, dateTo, onDateChange, onExport, canExport }: PoToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-[8px]">
      <div className="w-full border border-[#EEEEEE] bg-white sm:max-w-[396px]">
        <SearchInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search Purchase Orders"
          aria-label="Search purchase orders"
          className="h-[34px] rounded-none pl-[44px] text-caption-l placeholder:text-[#A3A3A3] lg:text-caption-l"
        />
      </div>
      <div className="flex items-center gap-[8px]">
        <DateFilterPopover
          dateFrom={dateFrom}
          dateTo={dateTo}
          onApply={onDateChange}
          triggerClassName="h-[36px] gap-[10px] border-[#EEEEEE] px-[7px] text-[14px] font-medium"
        />
        <button
          type="button"
          onClick={onExport}
          disabled={!canExport}
          aria-label="Download purchase orders as CSV"
          className="flex size-[36px] items-center justify-center bg-[#004DE7] text-white outline-none transition-colors hover:bg-[#003FC0] focus-visible:ring-2 focus-visible:ring-[#004DE7]/30 disabled:opacity-50"
        >
          <Download className="size-[14px]" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </div>
  );
}

PoToolbar.displayName = "PoToolbar";

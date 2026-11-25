import { Download } from "lucide-react";
import { SearchInput } from "@/components/atoms/search-input";
import { Select } from "@/components/atoms/select";
import { Spinner } from "@/components/atoms/spinner";
import { DateFilterPopover } from "@/components/molecules/date-filter-popover";
import type { TransactionCategoryInfo, TransactionListFilters } from "@/lib/project-types";

const ALL_CATEGORIES = "__all__";

interface ExpenseToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: TransactionListFilters;
  onFiltersChange: (next: TransactionListFilters) => void;
  categories: TransactionCategoryInfo[];
  exporting: boolean;
  onExport: () => void;
}

/** Search on the left; date range, category and CSV download on the right. */
export function ExpenseToolbar({ search, onSearchChange, filters, onFiltersChange, categories, exporting, onExport }: ExpenseToolbarProps) {
  const options = [{ value: ALL_CATEGORIES, label: "All Categories" }, ...categories.map((c) => ({ value: c.key, label: c.label }))];

  return (
    <div className="flex flex-wrap items-center justify-between gap-[8px]">
      <div className="w-full border border-[#EEEEEE] bg-white sm:max-w-[396px]">
        <SearchInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search Expenses"
          aria-label="Search expenses"
          className="h-[34px] rounded-none pl-[44px] text-caption-l placeholder:text-[#A3A3A3] lg:text-caption-l"
        />
      </div>
      <div className="flex items-center gap-[8px]">
        <DateFilterPopover
          dateFrom={filters.from ?? ""}
          dateTo={filters.to ?? ""}
          onApply={(from, to) => onFiltersChange({ ...filters, from: from || undefined, to: to || undefined })}
          triggerClassName="h-[36px] gap-[10px] border-[#EEEEEE] px-[7px] text-[14px] font-medium"
        />
        <div className="w-[138px]">
          <Select
            options={options}
            value={filters.category ?? ALL_CATEGORIES}
            onChange={(value) => onFiltersChange({ ...filters, category: value && value !== ALL_CATEGORIES ? value : undefined })}
            placeholder="All Categories"
            className="h-[36px] border-[#EEEEEE] px-[8px] text-[14px] font-medium"
            iconClassName="size-4 text-[#1E1E1E]"
            popupClassName="min-w-[200px]"
          />
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          aria-label="Download expenses as CSV"
          className="flex size-[36px] items-center justify-center bg-[#004DE7] text-white outline-none transition-colors hover:bg-[#003FC0] focus-visible:ring-2 focus-visible:ring-[#004DE7]/30 disabled:opacity-60"
        >
          {exporting ? <Spinner size="xs" tone="current" /> : <Download className="size-[14px]" strokeWidth={2.25} aria-hidden />}
        </button>
      </div>
    </div>
  );
}

ExpenseToolbar.displayName = "ExpenseToolbar";

import { ArrowUpDown, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/atoms/dropdown-menu";
import { DateInputField } from "@/components/molecules/date-input-field";
import { cn } from "@/lib/utils";
import { SORT_OPTIONS, type ProjectFilters, type ProjectSort } from "./project-filters";

const DATE_CLASS = "h-[36px] w-[142px] border border-[#EEEEEE] bg-white px-[14px] text-[14px]";

/** Search, a created-between date range and the sort menu. */
export function DashboardToolbar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
}: {
  filters: ProjectFilters;
  onFiltersChange: (filters: ProjectFilters) => void;
  sort: ProjectSort;
  onSortChange: (sort: ProjectSort) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="relative w-full min-w-0 sm:w-[396px]">
        <Search className="pointer-events-none absolute left-[16px] top-1/2 size-[18px] -translate-y-1/2 text-[#1E1E1E]" strokeWidth={1.5} />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          placeholder="Search stages"
          aria-label="Search projects"
          className="h-[36px] w-full appearance-none border border-[#EEEEEE] bg-white pl-[44px] pr-[16px] text-[14px] text-[#1E1E1E] outline-none placeholder:text-[#A5A5A5] focus:border-primary [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-[16px]">
        <div className="flex items-center gap-[14px]">
          <DateInputField
            aria-label="Created from"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(from) => onFiltersChange({ ...filters, from })}
            className={cn(DATE_CLASS, filters.from ? "text-[#1E1E1E]" : "text-[#A5A5A5]")}
          />
          <span aria-hidden className="text-[14px] text-[#1E1E1E]">---</span>
          <DateInputField
            aria-label="Created to"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(to) => onFiltersChange({ ...filters, to })}
            className={cn(DATE_CLASS, filters.to ? "text-[#1E1E1E]" : "text-[#A5A5A5]")}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Sort projects"
                className="flex h-[36px] items-center gap-[8px] border border-[#EEEEEE] bg-white px-[9px] text-[14px] text-[#1E1E1E] outline-none hover:bg-[#F5F5F5] focus-visible:ring-2 focus-visible:ring-gray-900/10"
              >
                Sort
                <ArrowUpDown className="size-[16px]" strokeWidth={1.75} aria-hidden />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-[190px]">
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => onSortChange(option.value)}
                className={cn(option.value === sort && "font-semibold")}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

DashboardToolbar.displayName = "DashboardToolbar";

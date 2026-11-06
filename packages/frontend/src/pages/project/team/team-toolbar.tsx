import { useState } from "react";
import { ArrowUpDown, ChevronDown, Search, X } from "lucide-react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TeamSort } from "./shared";

const OUTLINE_BUTTON =
  "flex h-[36px] items-center border border-[#EEEEEE] bg-white text-[14px] text-[#1E1E1E] outline-none transition-colors hover:bg-[#F9F9F9] focus-visible:ring-2 focus-visible:ring-gray-900/10";

interface TeamToolbarProps {
  total: number;
  search: string;
  onSearchChange: (value: string) => void;
  roles: string[];
  role: string | null;
  onRoleChange: (role: string | null) => void;
  sort: TeamSort;
  onSortChange: (sort: TeamSort) => void;
}

/** Headcount on the left; search, a role filter and newest/oldest on the right. */
export function TeamToolbar({
  total,
  search,
  onSearchChange,
  roles,
  role,
  onRoleChange,
  sort,
  onSortChange,
}: TeamToolbarProps) {
  const [searching, setSearching] = useState(Boolean(search));

  function closeSearch(): void {
    setSearching(false);
    onSearchChange("");
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-[24px]">
      <div className="flex h-[36px] items-center gap-[8px] bg-[#F5F5F5] px-[12px] text-[14px] font-medium text-[#1E1E1E]">
        <ReactSVG src={icons2.person} className="shrink-0 [&_svg]:size-[14px]" />
        <span aria-label={`${total} people`}>{total}</span>
      </div>

      <div className="flex items-center gap-[8px]">
        {searching ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-[12px] top-1/2 size-[16px] -translate-y-1/2 text-[#1E1E1E]" strokeWidth={1.5} />
            <input
              autoFocus
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name or email"
              aria-label="Search the team"
              className="h-[36px] w-[240px] border border-[#EEEEEE] bg-white pl-[36px] pr-[34px] text-[14px] text-[#1E1E1E] outline-none placeholder:text-[#A5A5A5] focus:border-primary"
            />
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Close search"
              className="absolute right-[6px] top-1/2 flex size-[24px] -translate-y-1/2 items-center justify-center text-[#737373] hover:text-[#1E1E1E]"
            >
              <X className="size-[14px]" strokeWidth={2} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSearching(true)}
            aria-label="Search the team"
            className={cn(OUTLINE_BUTTON, "w-[41px] justify-center border-[#F6F6F6]")}
          >
            <Search className="size-[18px]" strokeWidth={1.5} />
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" aria-label="Filter by role" className={cn(OUTLINE_BUTTON, "gap-[6px] px-[6px]", role && "border-primary text-primary")}>
                {role ?? "Roles"}
                <ChevronDown className="size-[14px]" strokeWidth={1.5} />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-[160px]">
            <DropdownMenuItem onSelect={() => onRoleChange(null)} className={cn(!role && "font-semibold")}>
              All roles
            </DropdownMenuItem>
            {roles.map((label) => (
              <DropdownMenuItem key={label} onSelect={() => onRoleChange(label)} className={cn(role === label && "font-semibold text-primary")}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={() => onSortChange(sort === "newest" ? "oldest" : "newest")}
          aria-label={`Sorted ${sort} first, switch order`}
          className={cn(OUTLINE_BUTTON, "gap-[6px] px-[8px]")}
        >
          {sort === "newest" ? "Newest" : "Oldest"}
          <ArrowUpDown className="size-[16px]" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

TeamToolbar.displayName = "TeamToolbar";

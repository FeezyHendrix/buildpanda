import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one look for every control that opens a filter popover — dropdowns, the
 * date range, the category select in a filter row. Neutral at rest; the label
 * says what is applied, so the trigger never changes colour to say so.
 */
export const FILTER_TRIGGER_CLASS =
  "inline-flex h-9 items-center gap-2 rounded-lg border border-[#F0F0F0] bg-white px-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-50";

export function FilterChevron() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-gray-400"
    >
      <path d="m3 4.5 3 3 3-3" />
    </svg>
  );
}

interface FilterTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Optional leading icon (e.g. a calendar for a date range). */
  icon?: ReactNode;
  children: ReactNode;
}

const FilterTrigger = forwardRef<HTMLButtonElement, FilterTriggerProps>(
  ({ icon, children, className, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(FILTER_TRIGGER_CLASS, className)} {...props}>
      {icon ? <span className="flex shrink-0 text-gray-400 [&>svg]:size-3.5">{icon}</span> : null}
      <span className="truncate">{children}</span>
      <FilterChevron />
    </button>
  ),
);
FilterTrigger.displayName = "FilterTrigger";

export { FilterTrigger, type FilterTriggerProps };

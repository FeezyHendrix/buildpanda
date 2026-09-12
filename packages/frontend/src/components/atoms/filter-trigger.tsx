import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one look for every control that opens a filter popover — dropdowns, the
 * date range, the category select in a filter row. Outlined and neutral at
 * rest, brand-tinted on hover and while open; the label says what is applied.
 */
export const FILTER_TRIGGER_CLASS =
  "inline-flex h-[38px] items-center gap-1 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink transition-colors hover:border-primary-500 hover:bg-primary-50 hover:text-primary-600 aria-expanded:border-primary-500 aria-expanded:bg-primary-50 aria-expanded:text-primary-600 focus-visible:border-primary-500 focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:border-line-disabled disabled:bg-surface-alt disabled:text-ink-disabled";

export function FilterChevron() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-ink-muted"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

interface FilterTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Optional leading icon (e.g. a calendar for a date range). */
  icon?: ReactNode;
  /** Number of applied values; renders the small brand counter. */
  count?: number;
  children: ReactNode;
}

const FilterTrigger = forwardRef<HTMLButtonElement, FilterTriggerProps>(
  ({ icon, count, children, className, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(FILTER_TRIGGER_CLASS, className)} {...props}>
      {icon ? <span className="flex shrink-0 text-ink-muted [&>svg]:size-4">{icon}</span> : null}
      <span className="truncate">{children}</span>
      {count ? (
        <span className="flex size-[18px] shrink-0 items-center justify-center rounded-sm bg-primary-500 text-[10px] font-medium leading-none text-white">
          {count}
        </span>
      ) : null}
      <FilterChevron />
    </button>
  ),
);
FilterTrigger.displayName = "FilterTrigger";

export { FilterTrigger, type FilterTriggerProps };

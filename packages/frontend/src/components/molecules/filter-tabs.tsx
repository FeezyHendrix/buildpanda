import { cn } from "@/lib/utils";

interface FilterTabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface FilterTabsProps<T extends string> {
  items: readonly FilterTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}

/** Shared list/board switch used by pages that offer a kanban view. */
const VIEW_MODE_ITEMS = [
  { value: "list", label: "List" },
  { value: "board", label: "Board" },
] as const;

/**
 * Segmented control for filtering a list by status or category. One design
 * for every page: a grey track with the active segment lifted to white.
 */
function FilterTabs<T extends string>({
  items,
  value,
  onChange,
  className,
  ariaLabel,
}: FilterTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full overflow-x-auto rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-1",
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
              selected
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900",
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span
                className={cn(
                  "ml-1.5 text-xs tabular-nums",
                  selected ? "text-gray-500" : "text-gray-400",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

FilterTabs.displayName = "FilterTabs";

export { FilterTabs, VIEW_MODE_ITEMS, type FilterTabItem, type FilterTabsProps };

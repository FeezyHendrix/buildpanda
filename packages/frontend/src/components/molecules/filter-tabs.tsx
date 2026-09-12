import { Fragment } from "react";
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
 * Segmented control (Ernest's SegmentControls): a grey track with the active
 * segment lifted to white, hairline separators between the resting segments,
 * counts in a small tag.
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
        "inline-flex max-w-full items-center overflow-x-auto rounded-lg bg-surface-track p-1",
        className,
      )}
    >
      {items.map((item, index) => {
        const selected = item.value === value;
        const nextSelected = items[index + 1]?.value === value;
        const showSeparator = index < items.length - 1 && !selected && !nextSelected;
        return (
          <Fragment key={item.value}>
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(item.value)}
              className={cn(
                "flex min-w-20 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1 text-sm transition-colors",
                "outline-none focus-visible:shadow-focus",
                selected
                  ? "bg-white font-semibold text-ink shadow-card"
                  : "font-normal text-ink hover:bg-black/5",
              )}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="rounded-sm bg-surface-brand px-1 py-0.5 text-[10px] font-medium leading-3 tabular-nums text-ink-muted">
                  {item.count}
                </span>
              ) : null}
            </button>
            <span
              aria-hidden="true"
              className={cn("h-3 w-px shrink-0 rounded-full bg-ink-disabled", !showSeparator && "invisible")}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

FilterTabs.displayName = "FilterTabs";

export { FilterTabs, VIEW_MODE_ITEMS, type FilterTabItem, type FilterTabsProps };

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Small trailing marker (a revision label, a count) rendered inside the tab. */
  badge?: ReactNode;
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * Underline content tabs: each tab swaps the panel below it. For narrowing a
 * list by status or category use `FilterTabs` instead.
 */
function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  ariaLabel,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex gap-1 overflow-x-auto border-b border-gray-100", className)}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            "shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors",
            value === item.id
              ? "border-b-2 border-primary-500 text-primary-600"
              : "text-gray-500 hover:text-gray-700",
          )}
        >
          {item.label}
          {item.badge ? (
            <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
              {item.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

Tabs.displayName = "Tabs";

export { Tabs, type TabItem, type TabsProps };

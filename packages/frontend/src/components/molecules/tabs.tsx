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
  /** Right-hand slot on the same rule (page actions). */
  actions?: ReactNode;
  className?: string;
  ariaLabel?: string;
}

/**
 * Underline content tabs (Ernest's PageTabsHeader): 16px medium labels 16px
 * apart on a hairline rule, the active one in ink with a 3px underline that
 * sits on the rule. For narrowing a list by status use `FilterTabs` instead.
 */
function Tabs<T extends string>({
  items,
  value,
  onChange,
  actions,
  className,
  ariaLabel,
}: TabsProps<T>) {
  return (
    <div className={cn("flex items-center justify-between gap-6 border-b border-line", className)}>
      <div role="tablist" aria-label={ariaLabel} className="flex gap-4 overflow-x-auto">
        {items.map((item) => {
          const selected = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(item.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap py-2 text-base font-medium transition-colors",
                selected ? "text-ink" : "text-ink-muted hover:text-ink",
                selected &&
                  "after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:bg-line-dark after:content-['']",
              )}
            >
              {item.label}
              {item.badge ? (
                <span className="text-sm font-medium text-ink-muted">{item.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3 py-1">{actions}</div> : null}
    </div>
  );
}

Tabs.displayName = "Tabs";

export { Tabs, type TabItem, type TabsProps };

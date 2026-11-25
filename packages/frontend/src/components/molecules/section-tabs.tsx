import { cn } from "@/lib/utils";

/**
 * The page-level switch (Contracts / Phases, Expenses / Purchase orders): boxed
 * segments, the open one lifted to white. It is not the shared underline `Tabs`
 * nor the `FilterTabs` track; those are different looks.
 */

interface SectionTabsProps<T extends string> {
  items: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}

export function SectionTabs<T extends string>({ items, value, onChange, ariaLabel }: SectionTabsProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex h-[36px] border border-[#EEEEEE] bg-[#F6F6F6]">
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.id)}
            className={cn(
              "px-[17px] text-caption-m text-[#1E1E1E] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#004DE7]/20",
              selected ? "-m-px border border-[#E0E0E0] bg-white font-semibold" : "font-medium hover:bg-[#EFEFEF]",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

SectionTabs.displayName = "SectionTabs";

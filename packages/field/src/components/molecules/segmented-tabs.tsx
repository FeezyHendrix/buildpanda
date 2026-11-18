import { Scroller } from "@/components/atoms/scroller";
import { memo } from "react";
import { Text } from "@/components/atoms";
import { cn } from "@/lib/utils";
export interface SegmentedTab<T extends string> {
    key: T;
    label: string;
}
interface SegmentedTabsProps<T extends string> {
    tabs: readonly SegmentedTab<T>[];
    active: T;
    onChange: (key: T) => void;
}
/**
 * Sub-tabs inside a page, mirroring the web's schedule sections.
 *
 * Memoised so switching tabs re-renders the strip once rather than on every
 * content re-render underneath it.
 */
function SegmentedTabsInner<T extends string>({ tabs, active, onChange }: SegmentedTabsProps<T>) {
    return (<Scroller horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-1">
      {tabs.map((tab) => {
            const isActive = tab.key === active;
            return (<button key={tab.key} onClick={() => onChange(tab.key)} role="tab" aria-selected={isActive} className={cn("min-h-11 justify-center rounded-full px-4", isActive ? "bg-primary-500" : "bg-surface border border-hairline")} type="button">
            <Text weight="semibold" tone={isActive ? "inverse" : "secondary"} className="text-[13px]">
              {tab.label}
            </Text>
          </button>);
        })}
    </Scroller>);
}
export const SegmentedTabs = memo(SegmentedTabsInner) as typeof SegmentedTabsInner;

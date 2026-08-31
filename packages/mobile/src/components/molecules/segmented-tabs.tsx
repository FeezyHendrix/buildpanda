import { memo } from "react";
import { Pressable, ScrollView } from "react-native";
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
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 pb-1"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            className={cn(
              "min-h-9 justify-center rounded-full px-4",
              isActive ? "bg-primary-500" : "bg-surface border border-hairline",
            )}
          >
            <Text
              weight="semibold"
              tone={isActive ? "inverse" : "secondary"}
              className="text-[13px]"
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export const SegmentedTabs = memo(SegmentedTabsInner) as typeof SegmentedTabsInner;

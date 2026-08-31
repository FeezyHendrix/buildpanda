import { memo } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./text";
import { cn } from "@/lib/utils";

interface OptionRowProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}

/** Segmented picker for short enum fields (priority, status) inside a form. */
function OptionRowInner<T extends string>({ label, options, value, onChange }: OptionRowProps<T>) {
  return (
    <View className="gap-2">
      <Text weight="semibold" className="text-[13px]">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const isActive = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              className={cn(
                "min-h-11 justify-center rounded-xl px-4",
                isActive ? "bg-primary-500" : "bg-surface-alt",
              )}
            >
              <Text
                weight="semibold"
                tone={isActive ? "inverse" : "secondary"}
                className="text-[13px]"
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const OptionRow = memo(OptionRowInner) as typeof OptionRowInner;

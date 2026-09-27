import { memo } from "react";
import { Pressable, View } from "react-native";
import { FieldLabel } from "./input";
import { Text } from "./text";
import { cn } from "@/lib/utils";

/** A bare string shows as itself; an object carries a label the value cannot (a person, a reason code). */
type Option<T extends string> = T | { value: T; label: string };

interface OptionRowProps<T extends string> {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (next: T) => void;
}

function normalise<T extends string>(option: Option<T>): { value: T; label: string } {
  return typeof option === "string" ? { value: option, label: option } : option;
}

/**
 * The one chip-row picker: short enums (priority, status), and any list of
 * choices that fits on a form (a reviewer, a folder, a delay reason). Chips
 * wrap rather than scroll so nothing is hidden off the right edge; every
 * chip is a 44px target.
 */
function OptionRowInner<T extends string>({ label, options, value, onChange }: OptionRowProps<T>) {
  return (
    <View className="gap-2">
      <FieldLabel>{label}</FieldLabel>
      <View className="flex-row flex-wrap gap-2">
        {options.map((raw) => {
          const option = normalise(raw);
          const isActive = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
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
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const OptionRow = memo(OptionRowInner) as typeof OptionRowInner;

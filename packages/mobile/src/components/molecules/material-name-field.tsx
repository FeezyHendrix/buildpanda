import { Pressable, View } from "react-native";
import { Field, Text } from "@/components/atoms";

export interface MaterialNameOption {
  name: string;
  unit: string;
}

/**
 * The material input with one-tap suggestions beneath it: the project's BoQ
 * lines and materials already seen on site, filtered by what is typed. Picking
 * one also hands back its unit so the movement lands on the same stock line.
 */
export function MaterialNameField({
  value,
  onChange,
  options,
  autoFocus,
}: {
  value: string;
  onChange: (name: string, unit?: string) => void;
  options: MaterialNameOption[];
  autoFocus?: boolean;
}) {
  const typed = value.trim().toLowerCase();
  const suggestions = options
    .filter((m) => m.name.toLowerCase() !== typed && (!typed || m.name.toLowerCase().includes(typed)))
    .slice(0, 6);

  function pick(name: string) {
    const match = options.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());
    onChange(name, match?.unit || undefined);
  }

  return (
    <View className="gap-2">
      <Field label="Material" value={value} onChangeText={pick} placeholder={options.length ? "Pick from the BoQ or type" : "e.g. Cement"} autoFocus={autoFocus} />
      {suggestions.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {suggestions.map((m) => (
            <Pressable key={m.name} accessibilityRole="button" onPress={() => pick(m.name)} className="min-h-11 justify-center rounded-xl bg-surface-alt px-4">
              <Text weight="semibold" tone="secondary" className="text-[13px]">{m.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

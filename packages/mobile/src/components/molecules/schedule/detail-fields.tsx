import { View } from "react-native";
import { Card, Text } from "@/components/atoms";

export interface DetailField {
  label: string;
  value: string | null | undefined;
}

/** What a label/value pair shows when nothing is recorded — the web's dash. */
export const ABSENT_VALUE = "—";

/**
 * Label/value pairs for a record. Every field stays in place and an empty one
 * shows a dash, as the web's key-date and stage cards do, so the crew can see
 * what is *not* recorded as well as what is.
 */
export function DetailFields({ fields }: { fields: readonly DetailField[] }) {
  return (
    <Card className="gap-3 p-4">
      {fields.map((field) => (
        <View key={field.label} className="gap-0.5">
          <Text tone="muted" weight="semibold" className="text-[11px] uppercase">
            {field.label}
          </Text>
          <Text className="text-[15px]">{field.value || ABSENT_VALUE}</Text>
        </View>
      ))}
    </Card>
  );
}

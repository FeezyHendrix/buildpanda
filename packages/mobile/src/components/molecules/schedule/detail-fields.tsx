import { View } from "react-native";
import { Card, Text } from "@/components/atoms";

export interface DetailField {
  label: string;
  value: string | null | undefined;
}

/**
 * Label/value pairs for a schedule record. Fields with nothing in them are
 * dropped rather than rendered as a dash, so the card shows what is actually
 * known instead of padding it out with blanks.
 */
export function DetailFields({ fields }: { fields: readonly DetailField[] }) {
  const present = fields.filter((field) => field.value !== null && field.value !== undefined && field.value !== "");

  if (present.length === 0) {
    return (
      <Card className="p-4">
        <Text tone="secondary" className="text-[13px]">
          Nothing has been recorded against this yet.
        </Text>
      </Card>
    );
  }

  return (
    <Card className="gap-3 p-4">
      {present.map((field) => (
        <View key={field.label} className="gap-0.5">
          <Text tone="muted" weight="semibold" className="text-[11px] uppercase">
            {field.label}
          </Text>
          <Text className="text-[15px]">{field.value}</Text>
        </View>
      ))}
    </Card>
  );
}

import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/atoms";

export function SheetStrip({
  sheets,
  activeId,
  onSelect,
}: {
  sheets: { id: string }[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
}) {
  if (sheets.length <= 1) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-14 border-b border-hairline bg-surface">
      <View className="flex-row items-center gap-2 px-4 py-2">
        {sheets.map((sheet, index) => {
          const active = sheet.id === activeId;
          return (
            <Pressable
              key={sheet.id}
              onPress={() => onSelect(sheet.id)}
              accessibilityRole="button"
              className={`h-9 flex-row items-center rounded-full px-3 ${active ? "bg-primary-50" : "bg-surface-alt"}`}
            >
              <Text weight="semibold" className={`text-xs ${active ? "text-primary-600" : "text-ink-secondary"}`}>
                P-{String(index + 1).padStart(2, "0")}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

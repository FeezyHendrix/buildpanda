import Ionicons from "@expo/vector-icons/Ionicons";
import { memo } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/atoms";
import { cn } from "@/lib/utils";

export interface CategoryCardData {
  id: string;
  name: string;
  fileCount: number;
  totalSize: string;
}

/** Per-category colour, mirroring the web's CategoryMetricsCard palette. */
const TONE_BG: Record<string, string> = {
  "Land Documents": "bg-primary-50",
  "Architectural Plans": "bg-[#E0FFFC]",
  "Contracts & Agreements": "bg-[#FFF3DE]",
  "Invoices & Receipts": "bg-[#EDE2FF]",
  "Government Approvals": "bg-[#FFE6F0]",
  "Inspection Certs": "bg-[#DEEAFF]",
};

const TONE_ICON: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  "Land Documents": "folder-outline",
  "Architectural Plans": "map-outline",
  "Contracts & Agreements": "hammer-outline",
  "Invoices & Receipts": "receipt-outline",
  "Government Approvals": "shield-checkmark-outline",
  "Inspection Certs": "clipboard-outline",
};

export const CategoryCard = memo(function CategoryCard({
  category,
  isWide,
  onPress,
}: {
  category: CategoryCardData;
  isWide: boolean;
  onPress: (name: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(category.name)}
      accessibilityRole="button"
      accessibilityLabel={`${category.name}, ${category.fileCount} files`}
      className={cn(
        "min-h-28 justify-between rounded-2xl border border-hairline bg-surface p-4 active:bg-surface-alt",
        isWide ? "w-[31.5%]" : "w-[48.5%]",
      )}
    >
      <View
        className={cn(
          "h-10 w-10 items-center justify-center rounded-xl",
          TONE_BG[category.name] ?? "bg-primary-50",
        )}
      >
        <Ionicons
          name={TONE_ICON[category.name] ?? "folder-outline"}
          size={18}
          color="#004DE7"
        />
      </View>
      <View className="pt-3">
        <Text weight="semibold" className="text-[15px]" numberOfLines={2}>
          {category.name}
        </Text>
        <Text tone="secondary" className="pt-0.5 text-xs">
          {category.fileCount} {category.fileCount === 1 ? "file" : "files"}
          {category.totalSize ? ` · ${category.totalSize}` : ""}
        </Text>
      </View>
    </Pressable>
  );
});

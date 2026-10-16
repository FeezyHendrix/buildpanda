import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "@/components/atoms";
import { ICON_BRAND, ICON_MUTED } from "@/constants/colors";
import type { HomeTool } from "@/lib/home-tools";

/** How many tools fit across a phone in one row, leaving room for "More". */
export const QUICK_TOOL_SLOTS = 4;

function Tile({ label, icon, onPress, muted = false }: { label: string; icon: HomeTool["icon"]; onPress: () => void; muted?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="min-h-20 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-1 py-2 active:bg-surface-alt">
      <View className={`h-12 w-12 items-center justify-center rounded-2xl ${muted ? "bg-surface-alt" : "bg-primary-50"}`}>
        <Ionicons name={icon} size={22} color={muted ? ICON_MUTED : ICON_BRAND} />
      </View>
      <Text weight="medium" className="min-h-8 w-full text-center text-[10px] leading-4" numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

/** The tools this person reaches for most, one tap from opening the app. */
export function QuickToolsBar({ tools }: { tools: readonly HomeTool[] }) {
  return (
    <View className="flex-row gap-1 rounded-2xl border border-hairline bg-surface p-2">
      {tools.slice(0, QUICK_TOOL_SLOTS).map((tool) => (
        <Tile key={tool.key} label={tool.label} icon={tool.icon} onPress={() => router.push(tool.href as never)} />
      ))}
      <Tile label="More" icon="grid-outline" muted onPress={() => router.push("/(tabs)/tools")} />
    </View>
  );
}

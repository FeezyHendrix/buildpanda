import Ionicons from "@expo/vector-icons/Ionicons";
import { View } from "react-native";
import { ICON_MUTED } from "@/constants/colors";
import { Text } from "./text";

/**
 * A record written on site that has not reached the server yet.
 *
 * One badge everywhere: an unlabelled cloud icon is not something a crew
 * member can be expected to read, and the app had four different versions of
 * this in five places.
 */
export function PendingBadge() {
  return (
    <View
      accessibilityLabel="Waiting to upload"
      className="flex-row items-center gap-1 rounded-full bg-surface-alt px-2 py-1"
    >
      <Ionicons name="cloud-upload-outline" size={12} color={ICON_MUTED} />
      <Text weight="semibold" tone="secondary" className="text-[10px] uppercase">
        Pending
      </Text>
    </View>
  );
}
PendingBadge.displayName = "PendingBadge";

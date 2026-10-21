import { Pressable, View } from "react-native";
import { Text } from "@/components/atoms";

/**
 * Shown where records are keyed by building but the building list has not
 * reached the device. It replaces a spinner that never resolved, which read as
 * a hung screen rather than something the crew could act on.
 */
export function BuildingUnavailable({ onReload, denied = false }: { onReload: () => void; denied?: boolean }) {
  return (
    <View className="items-center gap-3 py-12">
      <Text tone="secondary" className="text-center text-sm">
        {denied
          ? "Your role can't load this project's buildings, so building-scoped records can't open here. Ask your project manager to grant Buildings access."
          : "Buildings have not reached this device yet. Reconnect once, then reload to see these records."}
      </Text>
      {denied ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={onReload}
          className="min-h-11 justify-center px-4"
        >
          <Text tone="brand" weight="semibold">
            Reload buildings
          </Text>
        </Pressable>
      )}
    </View>
  );
}

BuildingUnavailable.displayName = "BuildingUnavailable";

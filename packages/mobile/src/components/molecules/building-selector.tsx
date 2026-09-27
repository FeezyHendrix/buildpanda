import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/atoms";
import { ICON_BRAND } from "@/constants/colors";
import { useProjectBuilding } from "@/hooks/use-project-building";
import { WorkspaceSheet } from "./workspace-sheet";

export function BuildingSelector() {
  const scope = useProjectBuilding();
  const [open, setOpen] = useState(false);
  const label = scope.building?.name ?? (scope.buildingId ? "Selected building" : "Choose a building");
  return (
    <View className="border-b border-hairline bg-surface px-4 py-2">
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Building: ${label}. Tap to switch building.`}
        className="min-h-11 flex-row items-center gap-3 rounded-xl bg-primary-50 px-3"
      >
        <Ionicons name="business-outline" size={18} color={ICON_BRAND} />
        <View className="min-w-0 flex-1">
          <Text tone="secondary" className="text-[10px] uppercase">Building</Text>
          <Text weight="semibold" tone="brand" className="text-sm" numberOfLines={1}>{label}</Text>
        </View>
        {scope.building?.code ? <Text tone="secondary" className="text-xs">{scope.building.code}</Text> : null}
        <Ionicons name="chevron-down" size={16} color={ICON_BRAND} />
      </Pressable>
      <WorkspaceSheet
        title="Choose a building"
        visible={open}
        loading={scope.isLoading}
        workspaces={scope.buildings.map((b) => ({ id: b.id, name: b.code ? `${b.name} (${b.code})` : b.name }))}
        activeId={scope.buildingId}
        onSelect={(id) => { scope.selectBuilding(id); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
      {!scope.isLoading && scope.buildings.length === 0 ? (
        <View className="pt-2">
          <Text tone="secondary" className="text-xs">
            {scope.error ? "Buildings are not available on this device yet. Reconnect to load them." : "No buildings have been added to this project yet."}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => void scope.refetch()} className="min-h-11 justify-center">
            <Text tone="brand" weight="semibold">Reload buildings</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

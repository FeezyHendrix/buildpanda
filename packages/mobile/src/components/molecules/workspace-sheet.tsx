import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spinner, Text } from "@/components/atoms";
import { cn } from "@/lib/utils";

export interface WorkspaceOption {
  id: string;
  name: string;
}

interface WorkspaceSheetProps {
  visible: boolean;
  workspaces: readonly WorkspaceOption[];
  activeId: string | undefined;
  busyId?: string;
  loading?: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/**
 * Switching workspace is a one-tap change of context, not a destination — a
 * sheet keeps the crew member on the screen they were already using.
 */
export function WorkspaceSheet({
  visible,
  workspaces,
  activeId,
  busyId,
  loading = false,
  onSelect,
  onClose,
}: WorkspaceSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Dismiss"
        className="flex-1 justify-end bg-black-900/40"
      >
        <Pressable
          onPress={() => undefined}
          className="rounded-t-3xl bg-surface"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <View className="items-center pt-3">
            <View className="h-1 w-10 rounded-full bg-grey-100" />
          </View>

          <View className="flex-row items-center px-5 pb-2 pt-4">
            <Text weight="bold" className="flex-1 text-lg">
              Switch workspace
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-surface-alt"
            >
              <Ionicons name="close" size={20} color="#717171" />
            </Pressable>
          </View>

          {loading ? (
            <View className="items-center py-10">
              <Spinner size="md" />
            </View>
          ) : (
            <ScrollView className="max-h-96" contentContainerClassName="px-4 pb-2">
              {workspaces.map((workspace) => {
                const isActive = workspace.id === activeId;
                return (
                  <Pressable
                    key={workspace.id}
                    onPress={() => onSelect(workspace.id)}
                    disabled={busyId === workspace.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    className={cn(
                      "mb-2 min-h-16 flex-row items-center gap-3 rounded-2xl border px-4 py-3",
                      isActive
                        ? "border-primary-200 bg-primary-50"
                        : "border-hairline bg-surface active:bg-surface-alt",
                    )}
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-500">
                      <Text weight="bold" tone="inverse" className="text-xs">
                        {workspace.name.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <Text weight="semibold" className="flex-1 text-base" numberOfLines={1}>
                      {workspace.name}
                    </Text>
                    {busyId === workspace.id ? (
                      <Spinner size="sm" />
                    ) : isActive ? (
                      <Ionicons name="checkmark" size={20} color="#004DE7" />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

WorkspaceSheet.displayName = "WorkspaceSheet";

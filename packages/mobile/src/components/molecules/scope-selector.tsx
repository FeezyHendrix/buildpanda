import Ionicons from "@expo/vector-icons/Ionicons";
import { memo } from "react";
import { Pressable, View } from "react-native";
import { Spinner, Text } from "@/components/atoms";
import { ICON_BRAND } from "@/constants/colors";

interface ScopeSelectorProps {
  workspaceName?: string;
  projectName?: string;
  projectPending?: boolean;
  onPressProject?: () => void;
  compact?: boolean;
}

/** The project switcher uses the same neutral surface as the v2 workspace. */
export const ScopeSelector = memo(function ScopeSelector({
  workspaceName,
  projectName,
  projectPending = false,
  onPressProject,
  compact = false,
}: ScopeSelectorProps) {
  return (
    <View className="min-w-0 flex-row items-stretch gap-2">
      <Pressable
        onPress={onPressProject}
        disabled={!onPressProject}
        accessibilityRole={onPressProject ? "button" : undefined}
        accessibilityLabel={
          projectName ? `Project: ${projectName}. Tap to switch project.` : undefined
        }
        className={
          compact
            ? "min-h-11 shrink flex-row items-center gap-2 rounded-lg bg-surface-alt px-3 active:bg-grey-100"
            : "min-h-11 flex-1 flex-row items-center gap-2 rounded-lg bg-surface-alt px-3 active:bg-grey-100"
        }
      >
        <Ionicons name="business-outline" size={16} color={ICON_BRAND} />
        <View className={compact ? "min-w-0 shrink" : "min-w-0 flex-1"}>
          {workspaceName && !compact ? (
            <Text
              tone="default"
              className="text-xs "
              numberOfLines={1}
            >
              {workspaceName}
            </Text>
          ) : null}
          {projectPending && !projectName ? (
            <View className="items-start py-0.5">
              <Spinner size="xs" tone="brand" />
            </View>
          ) : (
            <Text weight="semibold" tone="default" className={compact ? "text-xs" : "text-sm"} numberOfLines={1}>
              {projectName ?? "Choose a project"}
            </Text>
          )}
        </View>
        {onPressProject ? <Ionicons name="chevron-down" size={16} color={ICON_BRAND} /> : null}
      </Pressable>

    </View>
  );
});

export type { ScopeSelectorProps };

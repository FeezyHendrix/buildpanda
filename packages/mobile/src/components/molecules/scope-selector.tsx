import Ionicons from "@expo/vector-icons/Ionicons";
import { memo } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/atoms";

interface ScopeSelectorProps {
  workspaceName?: string;
  projectName?: string;
  onPressWorkspace?: () => void;
  onPressProject?: () => void;
  compact?: boolean;
}

/**
 * Sits on the blue header, so it uses translucent white fills rather than the
 * grey surfaces used on canvas.
 *
 * Memoised because it renders inside every page header and its props change far
 * less often than the screen content below it.
 */
export const ScopeSelector = memo(function ScopeSelector({
  workspaceName,
  projectName,
  onPressWorkspace,
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
        className="min-h-11 flex-1 flex-row items-center gap-2 rounded-xl bg-white/15 px-3 active:bg-white/25"
      >
        <Ionicons name="business-outline" size={16} color="#FFFFFF" />
        <View className="min-w-0 flex-1">
          {workspaceName && !compact ? (
            <Text
              tone="inverse"
              className="text-[10px] uppercase tracking-wide opacity-70"
              numberOfLines={1}
            >
              {workspaceName}
            </Text>
          ) : null}
          <Text weight="semibold" tone="inverse" className={compact ? "text-xs" : "text-sm"} numberOfLines={1}>
            {projectName ?? "Choose a project"}
          </Text>
        </View>
        {onPressProject ? <Ionicons name="chevron-down" size={16} color="#FFFFFF" /> : null}
      </Pressable>

      {onPressWorkspace && !compact ? (
        <Pressable
          onPress={onPressWorkspace}
          accessibilityRole="button"
          accessibilityLabel="Switch workspace"
          className="min-h-12 w-12 items-center justify-center rounded-xl bg-white/15 active:bg-white/25"
        >
          <Ionicons name="swap-horizontal-outline" size={18} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
});

export type { ScopeSelectorProps };

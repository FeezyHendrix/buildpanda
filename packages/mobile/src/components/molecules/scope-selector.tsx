import Ionicons from "@expo/vector-icons/Ionicons";
import { memo } from "react";
import { Pressable, View } from "react-native";
import { Spinner, Text } from "@/components/atoms";
import { ICON_INVERSE } from "@/constants/colors";

interface ScopeSelectorProps {
  workspaceName?: string;
  projectName?: string;
  /** The project is known but its name has not loaded yet: show a spinner, never a stand-in name. */
  projectPending?: boolean;
  onPressProject?: () => void;
  compact?: boolean;
}

/**
 * Sits on the blue header, so it uses translucent white fills rather than the
 * grey surfaces used on canvas. Only the project switches here; the workspace
 * is a rarer, deliberate change and lives under Account.
 *
 * Memoised because it renders inside every page header and its props change far
 * less often than the screen content below it.
 */
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
            ? "min-h-11 shrink flex-row items-center gap-2 rounded-xl bg-white/15 px-3 active:bg-white/25"
            : "min-h-11 flex-1 flex-row items-center gap-2 rounded-xl bg-white/15 px-3 active:bg-white/25"
        }
      >
        <Ionicons name="business-outline" size={16} color={ICON_INVERSE} />
        <View className={compact ? "min-w-0 shrink" : "min-w-0 flex-1"}>
          {workspaceName && !compact ? (
            <Text
              tone="inverse"
              className="text-[10px] uppercase tracking-wide opacity-70"
              numberOfLines={1}
            >
              {workspaceName}
            </Text>
          ) : null}
          {projectPending && !projectName ? (
            <View className="items-start py-0.5">
              <Spinner size="xs" tone="current" />
            </View>
          ) : (
            <Text weight="semibold" tone="inverse" className={compact ? "text-xs" : "text-sm"} numberOfLines={1}>
              {projectName ?? "Choose a project"}
            </Text>
          )}
        </View>
        {onPressProject ? <Ionicons name="chevron-down" size={16} color={ICON_INVERSE} /> : null}
      </Pressable>

    </View>
  );
});

export type { ScopeSelectorProps };

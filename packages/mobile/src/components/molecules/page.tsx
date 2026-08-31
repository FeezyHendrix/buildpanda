import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SyncIndicator, Text } from "@/components/atoms";
import { useSyncState } from "@/lib/sync-provider";
import { cn } from "@/lib/utils";
import { ScopeSelector } from "./scope-selector";

interface PageProps {
  /** `default` centres the title (Ernest's nav bar); `left` left-aligns it. */
  variant?: "default" | "left";
  title?: string;
  description?: string;
  onBack?: () => void;
  rightButtons?: ReactNode;
  showSync?: boolean;
  onPressSync?: () => void;
  workspaceName?: string;
  projectName?: string;
  onPressWorkspace?: () => void;
  onPressProject?: () => void;
  /** Set false when the child owns scrolling (FlatList screens). */
  scroll?: boolean;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

const SIDE_SLOT = "w-11";

/**
 * The single page chrome for every Field Tools screen: a BuildPanda-blue header
 * carrying the title, sync state and scope selector, over a light content area.
 *
 * The title centres by giving both side slots a fixed equal width, so it stays
 * optically centred regardless of how many buttons each side holds.
 */
export function Page({
  variant = "default",
  title,
  description,
  onBack,
  rightButtons,
  showSync = true,
  onPressSync,
  workspaceName,
  projectName,
  onPressWorkspace,
  onPressProject,
  scroll = true,
  footer,
  className,
  children,
}: PageProps) {
  const insets = useSafeAreaInsets();
  const sync = useSyncState();
  const isCentred = variant === "default";
  const hasBar = Boolean(onBack || title || rightButtons || showSync);
  const hasScope = Boolean(projectName || workspaceName);
  const handleSyncPress = onPressSync ?? (() => router.push("/sync"));

  return (
    <View className="flex-1 bg-canvas">
      <View className="bg-primary-500 px-4 pb-4" style={{ paddingTop: insets.top + 8 }}>
        {hasBar ? (
          <View className="flex-row items-center gap-2">
            <View className={cn("min-w-0 flex-1 flex-row items-center", !hasScope && isCentred && SIDE_SLOT)}>
              {onBack ? (
                <Pressable
                  onPress={onBack}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  className="-ml-2 h-11 w-11 items-center justify-center rounded-full active:bg-white/20"
                >
                  <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                </Pressable>
              ) : null}
              {hasScope ? (
                <View className="min-w-0 flex-1">
                  <ScopeSelector
                    workspaceName={workspaceName}
                    projectName={projectName}
                    onPressWorkspace={onPressWorkspace}
                    onPressProject={onPressProject}
                    compact
                  />
                </View>
              ) : null}
            </View>

            <View className={cn("min-w-0 flex-1 px-1", isCentred ? "items-center" : "items-start")}>
              {title ? (
                <Text weight="bold" tone="inverse" className="text-[17px]" numberOfLines={1}>
                  {title}
                </Text>
              ) : null}
              {description ? (
                <Text
                  tone="inverse"
                  className="text-xs opacity-80"
                  numberOfLines={1}
                >
                  {description}
                </Text>
              ) : null}
            </View>

            <View className={cn("flex-row items-center justify-end gap-1", isCentred && SIDE_SLOT)}>
              {rightButtons}
              {showSync ? (
                <SyncIndicator
                  state={sync.state}
                  pendingCount={sync.pendingCount}
                  onPress={handleSyncPress}
                  onDark
                />
              ) : null}
            </View>
          </View>
        ) : null}

      </View>

      {scroll ? (
        <ScrollView
          className={cn("px-4", className)}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View className={cn("flex-1 px-4 pt-4", className)}>{children}</View>
      )}

      {footer ? (
        <View className="px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

Page.displayName = "Page";

export type { PageProps };

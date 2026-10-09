import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SyncIndicator, Text } from "@/components/atoms";
import { ICON_DEFAULT } from "@/constants/colors";
import { useSyncState } from "@/lib/sync-provider";
import { cn } from "@/lib/utils";
import { BuildingSelector } from "./building-selector";
import { useProjectBuilding } from "@/hooks/use-project-building";
import { ScopeSelector } from "./scope-selector";
import { StageSelector } from "./stage-selector";
import { HeaderIconButton } from "./header-icon-button";

interface PageProps {
  /** Retained for callers; v2 headers use a leading title. */
  variant?: "default" | "left";
  title?: string;
  description?: string;
  onBack?: () => void;
  rightButtons?: ReactNode;
  showSync?: boolean;
  onPressSync?: () => void;
  workspaceName?: string;
  projectName?: string;
  /** Keeps the scope slot in place with a spinner while the project name loads. */
  projectPending?: boolean;
  onPressProject?: () => void;
  /** Set false when the child owns scrolling (FlatList screens). */
  scroll?: boolean;
  footer?: ReactNode;
  className?: string;
  buildingScope?: boolean;
  stageScope?: boolean;
  children: ReactNode;
}

/** Shared v2 page header, project switcher and offline-aware scope controls. */
function PageContent({
  title,
  description,
  onBack,
  rightButtons,
  showSync = true,
  onPressSync,
  workspaceName,
  projectName,
  projectPending = false,
  onPressProject,
  scroll = true,
  footer,
  className,
  children,
  buildingScope = false,
  stageScope = false,
}: PageProps) {
  const insets = useSafeAreaInsets();
  const sync = useSyncState();
  const hasScope = Boolean(projectName || workspaceName || projectPending || onPressProject);
  const handleSyncPress = onPressSync ?? (() => router.push("/sync"));

  return (
    <View className="flex-1 bg-canvas">
      <View className="border-b border-line bg-surface px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <View className="min-h-11 flex-row items-center gap-2">
          {onBack ? (
            <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back"
              className="-ml-2 h-11 w-11 items-center justify-center rounded-lg active:bg-surface-alt">
              <Ionicons name="chevron-back" size={22} color={ICON_DEFAULT} />
            </Pressable>
          ) : null}
          <View className="min-w-0 flex-1">
            {hasScope ? (
              <ScopeSelector workspaceName={workspaceName} projectName={projectName} projectPending={projectPending} onPressProject={onPressProject} />
            ) : title ? (
              <Text variant="heading" weight="bold" className="text-xl" numberOfLines={2}>{title}</Text>
            ) : null}
          </View>
          <View className="flex-row flex-wrap items-center justify-end gap-1">
            {rightButtons}
            {!onBack && title !== "Account" ? <HeaderIconButton icon="person-circle-outline" label="Account and workspace settings" onPress={() => router.push("/(tabs)/account")} /> : null}
            {showSync ? <SyncIndicator state={sync.state} pendingCount={sync.pendingCount} onPress={handleSyncPress} /> : null}
          </View>
        </View>
        {hasScope && title ? <Text variant="heading" weight="bold" className="pt-4 text-2xl">{title}</Text> : null}
        {description ? <Text tone="secondary" className="pt-1 text-sm">{description}</Text> : null}
      </View>
      {buildingScope ? <BuildingSelector /> : null}
      {stageScope ? <StageSelector /> : null}

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
      </KeyboardAvoidingView>
    </View>
  );
}

function BuildingPage(props: PageProps) {
  const { buildingId, isLoading } = useProjectBuilding();
  return (
    <PageContent {...props} footer={buildingId ? props.footer : undefined}>
      {buildingId ? props.children : (
        <View className="items-center py-12">
          <Text tone="secondary" className="text-center">
            {isLoading ? "Loading buildings…" : "Choose a building above to see its records."}
          </Text>
        </View>
      )}
    </PageContent>
  );
}

export function Page(props: PageProps) {
  return props.buildingScope ? <BuildingPage {...props} /> : <PageContent {...props} />;
}

Page.displayName = "Page";

export type { PageProps };

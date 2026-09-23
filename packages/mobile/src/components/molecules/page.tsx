import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SyncIndicator, Text } from "@/components/atoms";
import { ICON_INVERSE } from "@/constants/colors";
import { useSyncState } from "@/lib/sync-provider";
import { cn } from "@/lib/utils";
import { BuildingSelector } from "./building-selector";
import { useProjectBuilding } from "@/hooks/use-project-building";
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
  /** Keeps the scope slot in place with a spinner while the project name loads. */
  projectPending?: boolean;
  onPressProject?: () => void;
  /** Set false when the child owns scrolling (FlatList screens). */
  scroll?: boolean;
  footer?: ReactNode;
  className?: string;
  buildingScope?: boolean;
  children: ReactNode;
}

/**
 * The single page chrome for every Field Tools screen: a BuildPanda-blue header
 * carrying the title, sync state and scope selector, over a light content area.
 *
 * The centred title is an absolutely-positioned overlay, so it stays optically
 * centred no matter how wide the switcher or button cluster on either side is.
 */
function PageContent({
  variant = "default",
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
}: PageProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sync = useSyncState();
  // Project names are long ("Marbella Modern Phase 2 Block C"); give the
  // switcher just under half the bar, capped so a tablet does not stretch it.
  const scopeWidth = Math.min(320, Math.round(width * 0.45));
  const isCentred = variant === "default";
  const hasBar = Boolean(onBack || title || rightButtons || showSync);
  const hasScope = Boolean(projectName || workspaceName || projectPending);
  const titleBelowScope = isCentred && (hasScope || Boolean(rightButtons)) && width < 600;
  const [leftWidth, setLeftWidth] = useState(0);
  const [rightWidth, setRightWidth] = useState(0);
  const handleSyncPress = onPressSync ?? (() => router.push("/sync"));

  return (
    <View className="flex-1 bg-canvas">
      <View className="bg-primary-500 px-4 pb-4" style={{ paddingTop: insets.top + 8 }}>
        {hasBar ? (
          <View className="relative min-h-11 flex-row items-center justify-between gap-2">
            <View onLayout={(event) => setLeftWidth(event.nativeEvent.layout.width)} className={cn("min-w-0 flex-row items-center", !isCentred && "flex-1")}>
              {onBack ? (
                <Pressable
                  onPress={onBack}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  className="-ml-2 h-11 w-11 items-center justify-center rounded-full active:bg-white/20"
                >
                  <Ionicons name="chevron-back" size={24} color={ICON_INVERSE} />
                </Pressable>
              ) : null}
              {hasScope ? (
                <View className="min-w-0" style={{ maxWidth: scopeWidth }}>
                  <ScopeSelector
                    workspaceName={workspaceName}
                    projectName={projectName}
                    projectPending={projectPending}
                    onPressProject={onPressProject}
                    compact
                  />
                </View>
              ) : null}
              {!isCentred && title ? (
                <View className="min-w-0 flex-1 items-start px-1">
                  <Text weight="bold" tone="inverse" className="text-[17px]" numberOfLines={1}>
                    {title}
                  </Text>
                  {description ? (
                    <Text tone="inverse" className="text-xs opacity-80" numberOfLines={1}>
                      {description}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View onLayout={(event) => setRightWidth(event.nativeEvent.layout.width)} className="flex-row items-center justify-end gap-1">
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

            {isCentred && !titleBelowScope && (title || description) ? (
              <View
                pointerEvents="none"
                className="absolute inset-0 items-center justify-center"
                style={{ paddingHorizontal: Math.max(leftWidth, rightWidth, 44) + 8 }}
              >
                {title ? (
                  <Text weight="bold" tone="inverse" className="text-[17px]" numberOfLines={1}>
                    {title}
                  </Text>
                ) : null}
                {description ? (
                  <Text tone="inverse" className="text-xs opacity-80" numberOfLines={1}>
                    {description}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
        {titleBelowScope && title ? (
          <View className="pt-3">
            <Text weight="bold" tone="inverse" className="text-lg">{title}</Text>
            {description ? <Text tone="inverse" className="pt-1 text-xs opacity-80">{description}</Text> : null}
          </View>
        ) : null}
      </View>

      {buildingScope ? <BuildingSelector /> : null}

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

import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import type { ProposedAction, ProposedActionKind } from "@/api/voice-report";
import { Card, Text } from "@/components/atoms";
import { cn } from "@/lib/utils";

const META: Record<ProposedActionKind, { label: string; icon: ComponentProps<typeof Ionicons>["name"] }> = {
  rfi: { label: "RFI", icon: "help-circle-outline" },
  daily_log: { label: "Daily Log", icon: "clipboard-outline" },
  change_request: { label: "Change Request", icon: "swap-horizontal-outline" },
  material_order: { label: "Material Order", icon: "cube-outline" },
  look_ahead: { label: "Look Ahead", icon: "eye-outline" },
};

/**
 * The list of records Panda AI drafted from a voice note. Each row is a toggle:
 * included rows are created on confirm, excluded ones are dropped. Nothing here
 * writes anything — the parent owns the confirm.
 */
export function VoiceActionsReview({
  actions,
  includedIndexes,
  onToggle,
}: {
  actions: ProposedAction[];
  includedIndexes: ReadonlySet<number>;
  onToggle: (index: number) => void;
}) {
  return (
    <View className="gap-3">
      {actions.map((action, index) => {
        const meta = META[action.kind];
        const included = includedIndexes.has(index);
        return (
          <Pressable
            key={index}
            onPress={() => onToggle(index)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: included }}
          >
            <Card className={cn("flex-row items-start gap-3 p-4", !included && "opacity-50")}>
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
                <Ionicons name={meta.icon} size={20} color="#004DE7" />
              </View>
              <View className="min-w-0 flex-1">
                <Text tone="brand" weight="semibold" className="text-[11px] uppercase">
                  {meta.label}
                </Text>
                <Text weight="semibold" className="pt-0.5 text-[15px]" numberOfLines={2}>
                  {action.title}
                </Text>
                <Text tone="secondary" className="pt-1 text-[13px]" numberOfLines={3}>
                  {action.summary}
                </Text>
              </View>
              <Ionicons
                name={included ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={included ? "#004DE7" : "#C8C8C8"}
              />
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}

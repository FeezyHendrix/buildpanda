import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import type { ProposedAction, ProposedActionKind } from "@/api/voice-report-types";
import { Card, Text } from "@/components/atoms";
import { cn } from "@/lib/utils";

const META: Record<ProposedActionKind, { label: string; icon: ComponentProps<typeof Ionicons>["name"]; destructive?: boolean }> = {
  rfi: { label: "Raise RFI", icon: "help-circle-outline" },
  daily_log: { label: "Append Daily Log", icon: "clipboard-outline" },
  change_request: { label: "Submit Change Request", icon: "swap-horizontal-outline" },
  material_log: { label: "Log Material Movement", icon: "archive-outline" },
  material_order: { label: "Request Material", icon: "cube-outline" },
  look_ahead: { label: "Create Look Ahead", icon: "eye-outline" },
  update_rfi: { label: "Update RFI", icon: "create-outline" },
  transition_rfi: { label: "Change RFI Status", icon: "swap-vertical-outline" },
  update_change_request: { label: "Update Change Request", icon: "create-outline" },
  delete_change_request: { label: "Delete Change Request", icon: "trash-outline", destructive: true },
  update_material_order: { label: "Update Material Request", icon: "create-outline" },
  delete_material_order: { label: "Cancel Material Request", icon: "trash-outline", destructive: true },
  update_look_ahead: { label: "Update Look Ahead", icon: "create-outline" },
  delete_look_ahead: { label: "Delete Look Ahead", icon: "trash-outline", destructive: true },
  update_daily_log: { label: "Update Daily Log", icon: "time-outline" },
  log_activity: { label: "Log Activity Work", icon: "hammer-outline" },
  comment_rfi: { label: "Respond to RFI", icon: "chatbubble-outline" },
  comment_change_request: { label: "Comment on Change Request", icon: "chatbubble-outline" },
  void_ledger_entry: { label: "Void Material Entry", icon: "trash-outline", destructive: true },
  void_daily_log_entry: { label: "Void Diary Entry", icon: "trash-outline", destructive: true },
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
              <View className={cn("h-10 w-10 items-center justify-center rounded-xl", meta.destructive ? "bg-error-50" : "bg-primary-50")}>
                <Ionicons name={meta.icon} size={20} color={meta.destructive ? "#D42C19" : "#004DE7"} />
              </View>
              <View className="min-w-0 flex-1">
                <Text tone={meta.destructive ? "danger" : "brand"} weight="semibold" className="text-[11px] uppercase">
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

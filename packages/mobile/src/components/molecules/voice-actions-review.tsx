import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import type { ProposedAction, ProposedActionKind } from "@/api/voice-report-types";
import { Card, Text } from "@/components/atoms";
import { outstandingFields, type MissingFieldValues } from "@/lib/voice-missing-fields";
import { cn } from "@/lib/utils";
import { VoiceMissingFields } from "./voice-missing-fields";

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
  transition_stage: { label: "Update Build Stage", icon: "flag-outline" },
};

/** Icon + words, never colour alone — the badge has to read on a bright site. */
function NeedsBadge({ count }: { count: number }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-error-50 px-2 py-0.5">
      <Ionicons name="alert-circle" size={11} color="#D42C19" />
      <Text tone="danger" weight="semibold" className="text-[10px] uppercase">
        Needs {count} {count === 1 ? "detail" : "details"}
      </Text>
    </View>
  );
}

/**
 * The list of records Panda AI drafted from a voice note. Each row is a toggle:
 * included rows are created on confirm, excluded ones are dropped. Where the
 * speaker never said a required value the card collects it too, so only the
 * header row toggles — never the field area. Nothing here writes anything.
 */
export function VoiceActionsReview({
  actions,
  includedIndexes,
  values,
  onToggle,
  onChangeField,
}: {
  actions: ProposedAction[];
  includedIndexes: ReadonlySet<number>;
  values: MissingFieldValues;
  onToggle: (index: number) => void;
  onChangeField: (actionIndex: number, fieldName: string, value: string) => void;
}) {
  return (
    <View className="gap-3">
      {actions.map((action, index) => {
        const meta = META[action.kind];
        const included = includedIndexes.has(index);
        const answers = values[index];
        const showFields = included && action.missing.length > 0;
        const outstanding = showFields ? outstandingFields(action, answers).length : 0;
        return (
          <Card key={index} className={cn("p-4", !included && "opacity-50")}>
            <Pressable
              onPress={() => onToggle(index)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: included }}
              className="min-h-11 flex-row items-start gap-3"
            >
              <View className={cn("h-10 w-10 items-center justify-center rounded-xl", meta.destructive ? "bg-error-50" : "bg-primary-50")}>
                <Ionicons name={meta.icon} size={20} color={meta.destructive ? "#D42C19" : "#004DE7"} />
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text tone={meta.destructive ? "danger" : "brand"} weight="semibold" className="text-[11px] uppercase">
                    {meta.label}
                  </Text>
                  {outstanding > 0 ? <NeedsBadge count={outstanding} /> : null}
                </View>
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
            </Pressable>

            {showFields ? (
              <View className="mt-4 gap-4 border-t border-hairline pt-4">
                <Text tone="secondary" className="text-[12px]">
                  Panda AI couldn&apos;t hear {action.missing.length === 1 ? "this" : "these"} — add{" "}
                  {action.missing.length === 1 ? "it" : "them"} before saving.
                </Text>
                <VoiceMissingFields
                  fields={action.missing}
                  values={answers}
                  onChangeField={(fieldName, value) => onChangeField(index, fieldName, value)}
                />
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

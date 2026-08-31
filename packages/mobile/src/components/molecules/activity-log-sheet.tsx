import Ionicons from "@expo/vector-icons/Ionicons";
import { memo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Activity, DelayReason } from "@/api/activities";
import { Button, Field, Spinner, Text } from "@/components/atoms";
import { cn } from "@/lib/utils";

interface ActivityLogSheetProps {
  visible: boolean;
  activities: readonly Activity[];
  delayReasons: readonly DelayReason[];
  loading?: boolean;
  onLog: (input: {
    activityId: string;
    activityName: string;
    hoursLogged: number;
    delayReasonCode?: string | null;
    delayNote?: string | null;
  }) => Promise<void>;
  onClose: () => void;
}

export const ActivityLogSheet = memo(function ActivityLogSheet({
  visible,
  activities,
  delayReasons,
  loading = false,
  onLog,
  onClose,
}: ActivityLogSheetProps) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Activity | null>(null);
  const [hours, setHours] = useState("");
  const [delayed, setDelayed] = useState(false);
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [delayNote, setDelayNote] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setSelected(null);
    setHours("");
    setDelayed(false);
    setReasonCode(null);
    setDelayNote("");
  }

  async function handleLog() {
    if (!selected || !hours.trim()) return;
    setSaving(true);
    try {
      await onLog({
        activityId: selected.id,
        activityName: selected.name,
        hoursLogged: Number.parseFloat(hours) || 0,
        delayReasonCode: delayed ? reasonCode : null,
        delayNote: delayed && delayNote.trim() ? delayNote.trim() : null,
      });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} accessibilityLabel="Dismiss" className="flex-1 bg-black-900/40" />
      <View
        className="max-h-[85%] rounded-t-3xl bg-surface"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <View className="items-center pt-3">
          <View className="h-1 w-10 rounded-full bg-grey-100" />
        </View>
        <View className="flex-row items-center px-5 pb-2 pt-4">
          <Text weight="bold" className="flex-1 text-lg">
            {selected ? "Log hours" : "Pick an activity"}
          </Text>
          <Pressable onPress={() => { reset(); onClose(); }} hitSlop={8} className="h-9 w-9 items-center justify-center rounded-full active:bg-surface-alt">
            <Ionicons name="close" size={20} color="#717171" />
          </Pressable>
        </View>

        {loading ? (
          <View className="items-center py-10">
            <Spinner size="md" />
          </View>
        ) : !selected ? (
          <ScrollView className="max-h-96 px-4" contentContainerClassName="pb-4">
            {activities.length === 0 ? (
              <Text tone="secondary" className="py-6 text-center text-[13px]">
                No activities on this project yet.
              </Text>
            ) : (
              activities.map((activity) => (
                <Pressable
                  key={activity.id}
                  onPress={() => setSelected(activity)}
                  className="min-h-14 flex-row items-center gap-3 border-b border-hairline px-2 py-3 active:bg-surface-alt"
                >
                  <View className="min-w-0 flex-1">
                    <Text weight="semibold" className="text-[15px]" numberOfLines={1}>
                      {activity.name}
                    </Text>
                    {activity.phaseName ? (
                      <Text tone="secondary" className="text-xs" numberOfLines={1}>
                        {activity.phaseName}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    className={cn(
                      "rounded-full px-2 py-0.5",
                      activity.isDelayed ? "bg-error-50" : "bg-surface-alt",
                    )}
                  >
                    <Text
                      weight="semibold"
                      tone={activity.isDelayed ? "danger" : "secondary"}
                      className="text-[10px] uppercase"
                    >
                      {activity.isDelayed ? "Delayed" : activity.status}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        ) : (
          <ScrollView className="px-5" contentContainerClassName="gap-4 pb-4" keyboardShouldPersistTaps="handled">
            <View className="rounded-xl bg-surface-alt px-4 py-3">
              <Text weight="semibold" className="text-[15px]">
                {selected.name}
              </Text>
              {selected.phaseName ? (
                <Text tone="secondary" className="pt-0.5 text-xs">
                  {selected.phaseName}
                </Text>
              ) : null}
            </View>

            <Field
              label="Hours worked"
              value={hours}
              onChangeText={setHours}
              keyboardType="numeric"
              placeholder="0"
              autoFocus
            />

            <Pressable
              onPress={() => setDelayed((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: delayed }}
              className="min-h-12 flex-row items-center gap-3"
            >
              <Ionicons
                name={delayed ? "checkbox" : "square-outline"}
                size={22}
                color={delayed ? "#004DE7" : "#ADADAD"}
              />
              <Text weight="semibold" className="text-[15px]">
                Work was delayed
              </Text>
            </Pressable>

            {delayed ? (
              <View className="gap-3 pl-8">
                <Text weight="semibold" tone="secondary" className="text-xs uppercase tracking-wide">
                  Reason
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                  {delayReasons.map((reason) => {
                    const active = reasonCode === reason.code;
                    return (
                      <Pressable
                        key={reason.code}
                        onPress={() => setReasonCode(reason.code)}
                        className={cn(
                          "min-h-10 justify-center rounded-xl px-3",
                          active ? "bg-primary-500" : "bg-surface-alt",
                        )}
                      >
                        <Text
                          weight="semibold"
                          tone={active ? "inverse" : "secondary"}
                          className="text-[12px]"
                        >
                          {reason.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Field
                  label="Note (optional)"
                  value={delayNote}
                  onChangeText={setDelayNote}
                  placeholder="What happened?"
                  multiline
                  className="min-h-20"
                />
              </View>
            ) : null}

            <Button onPress={handleLog} loading={saving} disabled={!hours.trim()}>
              Log activity
            </Button>

            <Pressable onPress={reset} className="self-center py-2">
              <Text tone="brand" weight="semibold" className="text-sm">
                Pick a different activity
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
});

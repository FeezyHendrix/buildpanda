import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { Activity } from "@/api/activities";
import { Button, Card, Field, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { dailyLogsRepository } from "@/db/daily-logs-repository";
import { flushOutbox } from "@/db/outbox";
import { useLocalDb } from "@/db/provider";
import { useActivities, useDelayReasons } from "@/hooks/use-activities";
import { useFieldSession } from "@/lib/field-session";
import { cn } from "@/lib/utils";

// Logging an activity against a day is authoring a record, so it is a page.
// It used to be a bottom sheet, which this package's rule reserves for
// switching context or a short confirmation.

export default function LogActivity() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const activities = useActivities(projectId);
  const delayReasons = useDelayReasons();

  const [selected, setSelected] = useState<Activity | null>(null);
  const [hours, setHours] = useState("");
  const [delayed, setDelayed] = useState(false);
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [delayNote, setDelayNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logDate = date ?? "";

  async function handleLog() {
    if (!selected || !hours.trim() || !db || !projectId || !logDate) return;
    setSaving(true);
    setError(null);
    try {
      await dailyLogsRepository.logActivityLocal(db, projectId, logDate, {
        activityId: selected.id,
        activityName: selected.name,
        hoursLogged: Number.parseFloat(hours) || 0,
        delayReasonCode: delayed ? reasonCode : null,
        delayNote: delayed && delayNote.trim() ? delayNote.trim() : null,
      });
      void flushOutbox(db).catch(() => undefined);
      router.back();
    } catch (err) {
      console.error("log activity failed", err);
      setError(err instanceof Error && err.message ? err.message : "Couldn't log that activity.");
      setSaving(false);
    }
  }

  const list = (activities.data ?? []) as Activity[];

  return (
    <Page
      title={selected ? "Log hours" : "Pick an activity"}
      onBack={() => (selected ? setSelected(null) : router.back())}
      scroll={false}
      footer={
        selected ? (
          <View className="gap-2">
            {error ? (
              <Text tone="danger" className="px-1 text-xs">
                {error}
              </Text>
            ) : null}
            <Button onPress={handleLog} loading={saving} disabled={!hours.trim()}>
              Log activity
            </Button>
          </View>
        ) : undefined
      }
    >
      {!ready || activities.isPending ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : !selected ? (
        <ActivityPicker list={list} onPick={setSelected} />
      ) : (
        <ScrollView contentContainerClassName="gap-4 pb-4" keyboardShouldPersistTaps="handled">
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

          <Field label="Hours worked" value={hours} onChangeText={setHours} keyboardType="numeric" placeholder="0" autoFocus />

          <Pressable
            onPress={() => setDelayed((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: delayed }}
            className="min-h-11 flex-row items-center gap-3"
          >
            <Ionicons name={delayed ? "checkbox" : "square-outline"} size={22} color={delayed ? "#004DE7" : "#ADADAD"} />
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
                {(delayReasons.data ?? []).map((reason) => {
                  const active = reasonCode === reason.code;
                  return (
                    <Pressable
                      key={reason.code}
                      onPress={() => setReasonCode(reason.code)}
                      className={cn("min-h-11 justify-center rounded-xl px-3", active ? "bg-primary-500" : "bg-surface-alt")}
                    >
                      <Text weight="semibold" tone={active ? "inverse" : "secondary"} className="text-[12px]">
                        {reason.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Field label="Note (optional)" value={delayNote} onChangeText={setDelayNote} placeholder="What happened?" multiline className="min-h-20" />
            </View>
          ) : null}
        </ScrollView>
      )}
    </Page>
  );
}

function ActivityPicker({ list, onPick }: { list: Activity[]; onPick: (activity: Activity) => void }) {
  if (list.length === 0) {
    return (
      <View className="items-center py-12">
        <Text weight="semibold" className="text-center text-base">
          No activities yet
        </Text>
        <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
          Activities come from this project&apos;s programme. Ask your project manager to add one.
        </Text>
      </View>
    );
  }
  return (
    <ScrollView contentContainerClassName="pb-4">
      <Card>
        {list.map((activity) => (
          <Pressable
            key={activity.id}
            onPress={() => onPick(activity)}
            accessibilityRole="button"
            className="min-h-14 flex-row items-center gap-3 border-b border-hairline px-4 py-3 active:bg-surface-alt"
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
            <View className={cn("rounded-full px-2 py-0.5", activity.isDelayed ? "bg-error-50" : "bg-surface-alt")}>
              <Text weight="semibold" tone={activity.isDelayed ? "danger" : "secondary"} className="text-[10px] uppercase">
                {activity.isDelayed ? "Delayed" : activity.status}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C8C8C8" />
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}

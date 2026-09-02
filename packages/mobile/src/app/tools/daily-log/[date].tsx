import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Card, Field, Spinner, Text } from "@/components/atoms";
import { ActivityLogSheet } from "@/components/molecules/activity-log-sheet";
import { Page } from "@/components/molecules/page";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { activitiesApi, type Activity, type DelayReason } from "@/api/activities";
import { dailyLogsRepository } from "@/db/daily-logs-repository";
import { useAddDailyLogEntry, useDailyLogDay, useSaveDailyLog } from "@/hooks/use-daily-logs";
import { useProjectBuilding } from "@/hooks/use-project-building";
import { WorkspaceSheet } from "@/components/molecules/workspace-sheet";
import { useActivities } from "@/hooks/use-activities";
import { useSession } from "@/lib/auth-client";
import { useFieldSession } from "@/lib/field-session";
import { htmlToText } from "@/lib/html";
import { usePersistentQuery } from "@/lib/persistent-query";
import { cn } from "@/lib/utils";

function numberOrZero(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function DayEditor({ db, projectId, logDate }: { db: Db; projectId: string; logDate: string }) {
  const { day, entries, isPending } = useDailyLogDay(db, projectId, logDate);
  const save = useSaveDailyLog(db, projectId);
  const addEntry = useAddDailyLogEntry(db, projectId);
  const { buildingId, buildings, needsChoice, selectBuilding } = useProjectBuilding();
  const [buildingPickerOpen, setBuildingPickerOpen] = useState(false);

  // A multi-building project cannot take an entry until the block is known, so
  // the sheet opens itself rather than letting the write fail on submit.
  useEffect(() => {
    if (needsChoice) setBuildingPickerOpen(true);
  }, [needsChoice]);
  const { data: session } = useSession();

  const [hours, setHours] = useState("0");
  const [activitySheetOpen, setActivitySheetOpen] = useState(false);
  const activitiesResult = useActivities(projectId, true);
  const { storageOwnerId } = useFieldSession();
  const delayReasonsResult = usePersistentQuery({
    queryKey: ["delay-reasons"],
    ownerId: storageOwnerId,
    queryFn: activitiesApi.delayReasons,
  });

  const [entryHtml, setEntryHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Seed the form once from the stored day; later live updates must not stomp
  // on what the crew member is currently typing.
  useEffect(() => {
    if (hydrated || !day) return;
    setHours(String(day.totalHours));
    setHydrated(true);
  }, [day, hydrated]);

  const isVoided = day?.isVoided ?? false;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await save(logDate, { totalHours: numberOrZero(hours), buildingId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this log.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddEntry() {
    const text = htmlToText(entryHtml);
    if (!text) return;
    setError(null);
    try {
      await addEntry(logDate, text, session?.user.name ?? "You", entryHtml.trim() || null, buildingId);
      setEntryHtml("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that entry.");
    }
  }

  if (isPending) {
    return (
      <View className="items-center py-12">
        <Spinner size="md" />
      </View>
    );
  }

  return (
    <View className="gap-5">
      {isVoided ? (
        <View className="rounded-xl bg-surface-alt px-4 py-3">
          <Text tone="secondary" className="text-[13px]">
            This log has been voided and can no longer be edited.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View className="rounded-xl bg-error-50 px-4 py-3">
          <Text tone="danger" className="text-sm">
            {error}
          </Text>
        </View>
      ) : null}

      <View className={cn("gap-5", isVoided && "opacity-50")} pointerEvents={isVoided ? "none" : "auto"}>
        <Field
          label="Total hours"
          value={hours}
          onChangeText={setHours}
          keyboardType="number-pad"
        />

        <Button onPress={handleSave} loading={saving}>
          Save log
        </Button>
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text weight="bold" className="text-base">
            Activities logged
          </Text>
          {!isVoided ? (
            <Pressable
              onPress={() => setActivitySheetOpen(true)}
              accessibilityRole="button"
              className="flex-row items-center gap-1 rounded-full bg-primary-50 px-3 py-1.5 active:bg-primary-100"
            >
              <Ionicons name="add" size={16} color="#004DE7" />
              <Text weight="semibold" tone="brand" className="text-xs">
                Log activity
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text weight="bold" className="text-base">
          Entries
        </Text>

        {entries.length === 0 ? (
          <Text tone="secondary" className="text-[13px]">
            Nothing recorded for this day yet.
          </Text>
        ) : (
          <Card>
            {entries.map((entry) => (
              <View key={entry.id} className="border-b border-hairline px-4 py-3">
                <View className="flex-row items-center gap-2">
                  <Text weight="semibold" className="flex-1 text-[13px]" numberOfLines={1}>
                    {entry.authorName || "You"}
                  </Text>
                  {entry.isPendingSync ? (
                    <Ionicons name="cloud-upload-outline" size={13} color="#717171" />
                  ) : null}
                </View>
                <Text className={cn("pt-1 text-[15px]", entry.voided && "line-through opacity-50")}>
                  {entry.bodyText}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <ActivityLogSheet
          visible={activitySheetOpen}
          activities={(activitiesResult.data ?? []) as Activity[]}
          delayReasons={(delayReasonsResult.data ?? []) as DelayReason[]}
          loading={activitiesResult.isPending}
          onLog={async (input) => {
            await dailyLogsRepository.logActivityLocal(db, projectId, logDate, input);
            const { flushOutbox } = await import("@/db/outbox");
            void flushOutbox(db).catch(() => undefined);
          }}
          onClose={() => setActivitySheetOpen(false)}
        />

        {!isVoided ? (
          <View className="gap-2 pt-1">
            <RichTextEditor
              value={entryHtml}
              onChange={setEntryHtml}
              placeholder="What happened on site?"
              projectId={projectId}
            />
            <Pressable
              onPress={handleAddEntry}
              disabled={htmlToText(entryHtml).length === 0}
              accessibilityRole="button"
              accessibilityLabel="Add entry"
              className={cn(
                "min-h-12 items-center justify-center rounded-xl bg-primary-500",
                htmlToText(entryHtml).length === 0 && "opacity-50",
              )}
            >
              <Text weight="semibold" tone="inverse" className="text-[15px]">
                Add entry
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <WorkspaceSheet
        visible={buildingPickerOpen}
        workspaces={buildings.map((building) => ({
          id: building.id,
          name: building.code ? `${building.name} (${building.code})` : building.name,
        }))}
        activeId={buildingId}
        onSelect={(id) => {
          selectBuilding(id);
          setBuildingPickerOpen(false);
        }}
        onClose={() => setBuildingPickerOpen(false)}
      />
    </View>
  );
}

export default function DailyLogDay() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  const label = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "Daily Log";

  return (
    <Page title="Daily Log" description={label} onBack={() => router.back()}>
      {ready && db && projectId && date ? (
        <DayEditor db={db} projectId={projectId} logDate={date} />
      ) : (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      )}


    </Page>
  );
}

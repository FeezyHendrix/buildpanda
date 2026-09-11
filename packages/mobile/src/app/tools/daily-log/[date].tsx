import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import {
  WEATHER_CONDITIONS,
  WEATHER_CONDITION_LABELS,
  type WeatherCondition,
} from "@/api/daily-logs";
import { Button, Card, Field, OptionRow, PendingBadge, Spinner, Text } from "@/components/atoms";
import { ICON_BRAND } from "@/constants/colors";
import { Page } from "@/components/molecules/page";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useAddDailyLogEntry, useDailyLogDay, useSaveDailyLog } from "@/hooks/use-daily-logs";
import { useProjectBuilding } from "@/hooks/use-project-building";
import { WorkspaceSheet } from "@/components/molecules/workspace-sheet";
import { useSession } from "@/lib/auth-client";
import { formatLongDayLabel } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
import { htmlToText } from "@/lib/html";
import { cn } from "@/lib/utils";

function numberOrZero(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** Temperature can be negative and fractional; blank means not recorded. */
function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

// The option row shows the web's labels, not the enum, so map both ways.
const WEATHER_LABELS = WEATHER_CONDITIONS.map((condition) => WEATHER_CONDITION_LABELS[condition]);
function weatherFromLabel(label: string): WeatherCondition | null {
  return WEATHER_CONDITIONS.find((condition) => WEATHER_CONDITION_LABELS[condition] === label) ?? null;
}

function DayEditor({ db, projectId, logDate }: { db: Db; projectId: string; logDate: string }) {
  const { day, entries, isPending } = useDailyLogDay(db, projectId, logDate);
  const save = useSaveDailyLog(db, projectId);
  const addEntry = useAddDailyLogEntry(db, projectId);
  const { buildingId, buildings, needsChoice, selectBuilding } = useProjectBuilding();

  // A multi-building project cannot take an entry until the block is known, so
  // the sheet opens itself rather than letting the write fail on submit. Open
  // is derived: it shows while a choice is outstanding and has not been waved
  // away, so no effect has to push it open once the buildings load.
  const [pickerDismissed, setPickerDismissed] = useState(false);
  const buildingPickerOpen = needsChoice && !pickerDismissed;
  const { data: session } = useSession();

  // Untouched fields (`undefined` for weather, whose `null` means "no weather";
  // `null` for the strings) show the stored day, so the form fills in as soon
  // as the row arrives without an effect. Once typed in, a field keeps what
  // the crew member typed: a background refresh cannot stomp on it.
  const [weather, setWeather] = useState<WeatherCondition | null | undefined>(undefined);
  const [temperature, setTemperature] = useState<string | null>(null);
  const [workersExpected, setWorkersExpected] = useState<string | null>(null);
  const [workersPresent, setWorkersPresent] = useState<string | null>(null);
  const [hours, setHours] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [entryHtml, setEntryHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weatherValue = weather === undefined ? (day?.weatherCondition ?? null) : weather;
  const temperatureValue =
    temperature ?? (day?.temperatureC === null || day?.temperatureC === undefined ? "" : String(day.temperatureC));
  const workersExpectedValue = workersExpected ?? String(day?.workersExpected ?? 0);
  const workersPresentValue = workersPresent ?? String(day?.workersPresent ?? 0);
  const hoursValue = hours ?? String(day?.totalHours ?? 0);
  const summaryValue = summary ?? day?.summary ?? "";

  const isVoided = day?.isVoided ?? false;

  // A write with no building is refused by the API on a multi-building
  // project, and the queued row would fail for good. Ask now, or explain
  // that the building list has not loaded yet, instead of queuing it.
  function requireBuilding(): boolean {
    if (buildingId) return true;
    if (buildings.length > 1) {
      setPickerDismissed(false);
      return false;
    }
    setError("This project's buildings haven't loaded yet. Connect once so they can, then try again.");
    return false;
  }

  async function handleSave() {
    if (!requireBuilding()) return;
    setSaving(true);
    setError(null);
    try {
      await save(logDate, {
        weatherCondition: weatherValue,
        temperatureC: numberOrNull(temperatureValue),
        workersExpected: numberOrZero(workersExpectedValue),
        workersPresent: numberOrZero(workersPresentValue),
        totalHours: numberOrZero(hoursValue),
        summary: summaryValue.trim() || null,
        buildingId,
      });
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
    if (!requireBuilding()) return;
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
        <OptionRow
          label="Weather"
          options={WEATHER_LABELS}
          value={weatherValue ? WEATHER_CONDITION_LABELS[weatherValue] : ""}
          // Tapping the active option again clears it: no weather is a valid record.
          onChange={(label) =>
            setWeather(weatherValue && WEATHER_CONDITION_LABELS[weatherValue] === label ? null : weatherFromLabel(label))
          }
        />
        <Field
          label="Temperature °C"
          value={temperatureValue}
          onChangeText={setTemperature}
          keyboardType="numbers-and-punctuation"
          placeholder="Not recorded"
        />
        <View className="flex-row gap-3">
          <Field
            label="Workers expected"
            value={workersExpectedValue}
            onChangeText={setWorkersExpected}
            keyboardType="number-pad"
            className="flex-1"
          />
          <Field
            label="Workers present"
            value={workersPresentValue}
            onChangeText={setWorkersPresent}
            keyboardType="number-pad"
            className="flex-1"
          />
        </View>
        <Field
          label="Total hours"
          value={hoursValue}
          onChangeText={setHours}
          keyboardType="number-pad"
        />
        <Field
          label="Summary"
          value={summaryValue}
          onChangeText={setSummary}
          placeholder="How did the day go?"
          multiline
          textAlignVertical="top"
          className="min-h-24"
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
              onPress={() => router.push(`/tools/daily-log/log-activity?date=${logDate}` as never)}
              accessibilityRole="button"
              className="min-h-11 flex-row items-center gap-1 rounded-full bg-primary-50 px-4 active:bg-primary-100"
            >
              <Ionicons name="add" size={16} color={ICON_BRAND} />
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
          <View className="items-center py-8">
            <Text weight="semibold" className="text-center text-base">
              Nothing recorded yet
            </Text>
            <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
              Log an activity above to start this day&apos;s report.
            </Text>
          </View>
        ) : (
          <Card>
            {entries.map((entry) => (
              <View key={entry.id} className="border-b border-hairline px-4 py-3">
                <View className="flex-row items-center gap-2">
                  <Text weight="semibold" className="flex-1 text-[13px]" numberOfLines={1}>
                    {entry.authorName || "You"}
                  </Text>
                  {entry.isPendingSync ? <PendingBadge /> : null}
                </View>
                <Text className={cn("pt-1 text-[15px]", entry.voided && "line-through opacity-50")}>
                  {entry.bodyText}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {!isVoided ? (
          <View className="gap-2 pt-1">
            <RichTextEditor
              value={entryHtml}
              onChange={setEntryHtml}
              placeholder="What happened on site?"
              projectId={projectId}
            />
            <Button onPress={handleAddEntry} disabled={htmlToText(entryHtml).length === 0}>
              Add entry
            </Button>
          </View>
        ) : null}
      </View>

      <WorkspaceSheet
        title="Choose a building"
        visible={buildingPickerOpen}
        workspaces={buildings.map((building) => ({
          id: building.id,
          name: building.code ? `${building.name} (${building.code})` : building.name,
        }))}
        activeId={buildingId}
        onSelect={selectBuilding}
        onClose={() => setPickerDismissed(true)}
      />
    </View>
  );
}

export default function DailyLogDay() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  const label = date ? formatLongDayLabel(date) || date : undefined;

  return (
    <Page title="Daily log" description={label} onBack={() => router.back()}>
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

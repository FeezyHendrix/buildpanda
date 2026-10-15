import { DailyLogNotes } from "./daily-log-notes";
import { useProjectAccess } from "@/lib/project-access-provider";
import { features } from "@/lib/feature-access";
import { goBack } from "@/lib/navigation";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  WEATHER_CONDITIONS,
  WEATHER_CONDITION_LABELS,
  type WeatherCondition,
} from "@/api/daily-logs";
import { Button, Field, OptionRow, Spinner, Text } from "@/components/atoms";
import { BuildingUnavailable } from "@/components/molecules/building-unavailable";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useDailyLogDay, useSaveDailyLog } from "@/hooks/use-daily-logs";
import { useProjectBuilding } from "@/hooks/use-project-building";
import { formatLongDayLabel, isIsoDate, localIsoDate } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
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

function DayEditor({ db, projectId, logDate, buildingId, creating }: { db: Db; projectId: string; logDate: string; buildingId: string; creating: boolean }) {
  const { day, entries, activities, isPending } = useDailyLogDay(db, projectId, logDate, buildingId, !creating);
  const save = useSaveDailyLog(db, projectId);


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
  const { allows } = useProjectAccess();
  const editable = !isVoided && allows(features.dailyLog.actions.create);

  async function handleSave() {
    if (!editable || saving) return;
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
      if (creating) router.replace("/tools/daily-log");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this log.");
    } finally {
      setSaving(false);
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

      <View className={cn("gap-5", isVoided && "opacity-50")} pointerEvents={editable ? "auto" : "none"}>
        <OptionRow disabled={!editable}
          label="Weather"
          options={WEATHER_LABELS}
          value={weatherValue ? WEATHER_CONDITION_LABELS[weatherValue] : ""}
          // Tapping the active option again clears it: no weather is a valid record.
          onChange={(label) =>
            setWeather(weatherValue && WEATHER_CONDITION_LABELS[weatherValue] === label ? null : weatherFromLabel(label))
          }
        />
        <Field editable={editable}
          label="Temperature °C"
          value={temperatureValue}
          onChangeText={setTemperature}
          keyboardType="numbers-and-punctuation"
          placeholder="Not recorded"
        />
        <View className="flex-row gap-3">
          <Field editable={editable}
            label="Workers expected"
            value={workersExpectedValue}
            onChangeText={setWorkersExpected}
            keyboardType="number-pad"
            className="flex-1"
          />
          <Field editable={editable}
            label="Workers present"
            value={workersPresentValue}
            onChangeText={setWorkersPresent}
            keyboardType="number-pad"
            className="flex-1"
          />
        </View>
        <Field editable={editable}
          label="Total hours"
          value={hoursValue}
          onChangeText={setHours}
          keyboardType="number-pad"
        />
        <Field editable={editable}
          label="Summary"
          value={summaryValue}
          onChangeText={setSummary}
          placeholder="How did the day go?"
          multiline
          textAlignVertical="top"
          className="min-h-24"
        />

        <Button permission={features.dailyLog.actions.create} onPress={handleSave} loading={saving}>
          Save log
        </Button>
      </View>

      {!creating ? <DailyLogNotes db={db} projectId={projectId} buildingId={buildingId} logDate={logDate}
        entries={entries} activities={activities} editable={editable} /> : null}


    </View>
  );
}

export function DailyLogPage({ creating = false }: { creating?: boolean }) {
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date ?? localIsoDate();
  const { projectId } = useFieldSession();
  const { buildingId, isLoading: buildingsLoading, refetch: reloadBuildings } = useProjectBuilding();
  const { db, ready } = useLocalDb();

  const validDate = isIsoDate(date) && date <= localIsoDate();
  const label = validDate ? formatLongDayLabel(date) : undefined;

  return (
    <Page buildingScope title={creating ? "New daily log" : "Daily log"} description={label} onBack={() => goBack()}>
      {!validDate ? <Text tone="danger">Choose today or an earlier date for a daily log.</Text> : ready && db && projectId && buildingId ? (
        <DayEditor key={`${projectId}:${buildingId}:${date}`} db={db} projectId={projectId} logDate={date} buildingId={buildingId} creating={creating} />
      ) : !ready || buildingsLoading ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : (
        <BuildingUnavailable onReload={() => void reloadBuildings()} />
      )}
    </Page>
  );
}

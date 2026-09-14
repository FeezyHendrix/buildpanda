import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Card, PendingBadge, Spinner, Text } from "@/components/atoms";
import { ICON_BRAND, ICON_FAINT } from "@/constants/colors";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { todayIso } from "@/db/daily-logs-repository";
import { useLocalDb } from "@/db/provider";
import { useDailyLogDays } from "@/hooks/use-daily-logs";
import { formatDayLabel } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";

function DayList({ db, projectId }: { db: Db; projectId: string }) {
  const { data, isPending } = useDailyLogDays(db, projectId);
  const today = todayIso();
  const hasToday = data.some((d) => d.logDate === today);

  if (isPending) {
    return (
      <View className="items-center py-12">
        <Spinner size="md" />
      </View>
    );
  }

  return (
    <>
      {!hasToday ? (
        <Pressable
          onPress={() => router.push(`/tools/daily-log/${today}`)}
          accessibilityRole="button"
          className="mb-3 min-h-16 flex-row items-center gap-3 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 active:bg-primary-100"
        >
          <Ionicons name="add-circle-outline" size={22} color={ICON_BRAND} />
          <View className="flex-1">
            <Text weight="semibold" tone="brand" className="text-[15px]">
              Start today&apos;s log
            </Text>
            <Text tone="secondary" className="pt-0.5 text-xs">
              {formatDayLabel(today)}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {data.length === 0 ? (
        <View className="items-center py-12">
          <Text weight="semibold" className="text-center text-base">
            No logs yet
          </Text>
          <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
            A daily log records weather, crew and what happened on site.
          </Text>
        </View>
      ) : (
        <Card>
          {data.map((day) => (
            <Pressable
              key={day.id}
              onPress={() => router.push(`/tools/daily-log/${day.logDate}`)}
              accessibilityRole="button"
              className="min-h-16 flex-row items-center gap-3 border-b border-hairline px-4 py-3 active:bg-surface-alt"
            >
              <View className="min-w-0 flex-1">
                <Text weight="semibold" className="text-[15px]">
                  {formatDayLabel(day.logDate) || day.logDate}
                  {day.logDate === today ? " · Today" : ""}
                </Text>
                <Text tone="secondary" className="pt-0.5 text-xs">
                  {day.totalHours}h logged
                </Text>
              </View>

              {day.isVoided ? (
                <View className="rounded-full bg-surface-alt px-2 py-1">
                  <Text weight="semibold" tone="secondary" className="text-[10px] uppercase">
                    Void
                  </Text>
                </View>
              ) : day.isPendingSync ? (
                <PendingBadge />
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={ICON_FAINT} />
            </Pressable>
          ))}
        </Card>
      )}
    </>
  );
}

export default function DailyLogIndex() {
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  return (
    <Page title="Daily log" onBack={() => router.back()}>
      {ready && db && projectId ? (
        <DayList db={db} projectId={projectId} />
      ) : (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      )}
    </Page>
  );
}

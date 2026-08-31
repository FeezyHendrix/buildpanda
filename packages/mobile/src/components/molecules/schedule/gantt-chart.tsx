import { ScrollView, View } from "react-native";
import type { Activity } from "@/api/activities";
import { Card, Text } from "@/components/atoms";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const LEFT_WIDTH = 156;
const DAY_WIDTH = 26;
const MIN_BAR_WIDTH = 24;

function parseDay(value: string): number | null {
  const time = Date.parse(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(time) ? null : time;
}

function dateLabel(time: number): string {
  return new Date(time).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function activitySpan(activity: Activity): { readonly start: number; readonly end: number } | null {
  const start = parseDay(activity.plannedStartAt);
  const end = parseDay(activity.plannedEndAt);
  if (start === null || end === null) return null;
  return { start, end: Math.max(end, start) };
}

export function GanttChart({ activities }: { activities: readonly Activity[] }) {
  const rows = activities
    .map((activity) => ({ activity, span: activitySpan(activity) }))
    .filter((row): row is { readonly activity: Activity; readonly span: { readonly start: number; readonly end: number } } => row.span !== null)
    .sort((a, b) => a.span.start - b.span.start);

  if (rows.length === 0) {
    return (
      <View className="items-center py-12">
        <Text weight="semibold" className="text-base">
          Nothing to chart
        </Text>
        <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
          Activities need planned start and end dates before they can appear on the chart.
        </Text>
      </View>
    );
  }

  const min = Math.min(...rows.map((row) => row.span.start));
  const max = Math.max(...rows.map((row) => row.span.end));
  const days = Math.max(1, Math.round((max - min) / DAY_MS) + 1);
  const timelineWidth = days * DAY_WIDTH;
  const ticks = Array.from({ length: Math.ceil(days / 7) + 1 }, (_, index) => min + index * 7 * DAY_MS).filter((time) => time <= max + 7 * DAY_MS);

  return (
    <Card className="overflow-hidden">
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ width: LEFT_WIDTH + timelineWidth }}>
          <View className="flex-row border-b border-hairline bg-surface-alt">
            <View className="justify-center px-4 py-3" style={{ width: LEFT_WIDTH }}>
              <Text weight="semibold" tone="secondary" className="text-[11px] uppercase">
                Activity
              </Text>
            </View>
            <View className="relative flex-1 py-3" style={{ width: timelineWidth }}>
              {ticks.map((tick) => (
                <View key={tick} className="absolute top-0 h-full border-l border-hairline" style={{ left: Math.round((tick - min) / DAY_MS) * DAY_WIDTH }}>
                  <Text tone="muted" className="pl-1 text-[10px]">
                    {dateLabel(tick)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {rows.map(({ activity, span }) => {
            const left = Math.round((span.start - min) / DAY_MS) * DAY_WIDTH;
            const width = Math.max(MIN_BAR_WIDTH, (Math.round((span.end - span.start) / DAY_MS) + 1) * DAY_WIDTH);
            return (
              <View key={activity.id} className="flex-row border-b border-hairline">
                <View className="justify-center px-4 py-3" style={{ width: LEFT_WIDTH }}>
                  <Text weight="semibold" className="text-[13px]" numberOfLines={1}>
                    {activity.name}
                  </Text>
                  <Text tone="secondary" className="pt-0.5 text-[11px]" numberOfLines={1}>
                    {[activity.phaseName, activity.location].filter(Boolean).join(" · ") || activity.status}
                  </Text>
                </View>
                <View className="relative justify-center" style={{ width: timelineWidth }}>
                  {ticks.map((tick) => (
                    <View key={`${activity.id}-${tick}`} className="absolute h-full border-l border-hairline" style={{ left: Math.round((tick - min) / DAY_MS) * DAY_WIDTH }} />
                  ))}
                  <View
                    className={cn("h-8 justify-center rounded-full px-3", activity.isDelayed ? "bg-error-500" : "bg-primary-500")}
                    style={{ marginLeft: left, width }}
                  >
                    <Text weight="semibold" tone="inverse" className="text-[11px]" numberOfLines={1}>
                      {activity.status}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Card>
  );
}

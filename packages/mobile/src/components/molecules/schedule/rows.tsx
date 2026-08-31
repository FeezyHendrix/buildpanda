import { View } from "react-native";
import { Text } from "@/components/atoms";
import type { Activity } from "@/api/activities";
import type { KeyDate } from "@/api/key-dates";
import type { Stage } from "@/api/stages";
import { cn } from "@/lib/utils";

function dayLabel(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function Chip({ label, tone }: { label: string; tone: "neutral" | "danger" | "brand" }) {
  return (
    <View
      className={cn(
        "rounded-full px-2 py-1",
        tone === "danger" ? "bg-error-50" : tone === "brand" ? "bg-primary-50" : "bg-surface-alt",
      )}
    >
      <Text
        weight="semibold"
        tone={tone === "danger" ? "danger" : tone === "brand" ? "brand" : "secondary"}
        className="text-[10px] uppercase"
      >
        {label}
      </Text>
    </View>
  );
}

const Row = ({ title, subtitle, right }: { title: string; subtitle: string; right: React.ReactNode }) => (
  <View className="min-h-16 flex-row items-center gap-3 border-b border-hairline px-4 py-3">
    <View className="min-w-0 flex-1">
      <Text weight="semibold" className="text-[15px]" numberOfLines={1}>
        {title}
      </Text>
      <Text tone="secondary" className="pt-0.5 text-xs" numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
    {right}
  </View>
);

export function ActivityRow({ activity }: { activity: Activity }) {
  return (
    <Row
      title={activity.name}
      subtitle={
        [activity.phaseName, activity.location].filter(Boolean).join(" · ") ||
        `${dayLabel(activity.plannedStartAt)} – ${dayLabel(activity.plannedEndAt)}`
      }
      right={
        activity.isDelayed ? (
          <Chip label="Delayed" tone="danger" />
        ) : (
          <Chip label={activity.status} tone="neutral" />
        )
      }
    />
  );
}

export function StageRow({ stage }: { stage: Stage }) {
  return (
    <Row
      title={stage.name}
      subtitle={stage.dateRange ?? `${dayLabel(stage.startDate)} – ${dayLabel(stage.endDate)}`}
      right={<Chip label={`${stage.progressPercent}%`} tone="brand" />}
    />
  );
}

export function KeyDateRow({ keyDate }: { keyDate: KeyDate }) {
  return (
    <Row
      title={keyDate.label}
      subtitle={
        keyDate.actualDate
          ? `Actual ${dayLabel(keyDate.actualDate)}`
          : `Target ${dayLabel(keyDate.targetDate)}`
      }
      right={<Chip label={keyDate.status} tone="neutral" />}
    />
  );
}

export function TimelineRow({ activity }: { activity: Activity }) {
  return (
    <Row
      title={activity.name}
      subtitle={`${dayLabel(activity.plannedStartAt)} – ${dayLabel(activity.plannedEndAt)}`}
      right={<Chip label={activity.status} tone={activity.isDelayed ? "danger" : "neutral"} />}
    />
  );
}

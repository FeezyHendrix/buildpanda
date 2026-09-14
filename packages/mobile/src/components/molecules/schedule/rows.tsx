import { Pressable, View } from "react-native";
import { PendingBadge, Text } from "@/components/atoms";
import type { Activity } from "@/api/activities";
import type { KeyDate } from "@/api/key-dates";
import type { Stage } from "@/api/stages";
import { formatDateRange, formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface LookAheadListItem {
  name: string;
  startDate: string;
  endDate: string;
  totalWorkers: number | null;
  status: string;
  isPendingSync?: boolean;
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
        formatDateRange(activity.plannedStartAt, activity.plannedEndAt)
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
      subtitle={stage.dateRange ?? formatDateRange(stage.startDate, stage.endDate)}
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
          ? `Actual ${formatShortDate(keyDate.actualDate) || "—"}`
          : `Target ${formatShortDate(keyDate.targetDate) || "—"}`
      }
      right={<Chip label={keyDate.status} tone="neutral" />}
    />
  );
}

export function LookAheadRow({
  lookAhead,
  onPress,
}: {
  lookAhead: LookAheadListItem;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="active:bg-surface-alt">
      <Row
        title={lookAhead.name}
        subtitle={`${formatDateRange(lookAhead.startDate, lookAhead.endDate)}${
          lookAhead.totalWorkers ? ` · ${lookAhead.totalWorkers} workers` : ""
        }`}
        right={lookAhead.isPendingSync ? <PendingBadge /> : <Chip label={lookAhead.status} tone="neutral" />}
      />
    </Pressable>
  );
}

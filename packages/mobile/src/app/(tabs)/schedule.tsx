import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { Activity } from "@/api/activities";
import type { KeyDate } from "@/api/key-dates";
import type { Stage } from "@/api/stages";
import { Card, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import {
  ActivityRow,
  KeyDateRow,
  LookAheadRow,
} from "@/components/molecules/schedule/rows";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useActivities } from "@/hooks/use-activities";
import { useKeyDates } from "@/hooks/use-key-dates";
import { useLocalLookAheads } from "@/hooks/use-local-look-aheads";
import { useProject } from "@/hooks/use-projects";
import { useStages } from "@/hooks/use-stages";
import { useFieldSession } from "@/lib/field-session";

const MS_PER_DAY = 86_400_000;
const PREVIEW_COUNT = 3;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysFromToday(iso: string): number {
  return Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / MS_PER_DAY);
}

function currentStage(stages: Stage[]): Stage | null {
  const ordered = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
  return ordered.find((s) => s.progressPercent < 100) ?? ordered[ordered.length - 1] ?? null;
}

function nextKeyDate(keyDates: KeyDate[]): KeyDate | null {
  const upcoming = keyDates
    .filter((k) => !k.actualDate && k.targetDate)
    .sort((a, b) => (a.targetDate ?? "").localeCompare(b.targetDate ?? ""));
  return upcoming[0] ?? null;
}

function activityPreview(activities: Activity[]): Activity[] {
  const now = Date.now();
  const live = activities.filter(
    (a) => new Date(a.plannedStartAt).getTime() <= now && now <= new Date(a.plannedEndAt).getTime(),
  );
  const upcoming = activities
    .filter((a) => new Date(a.plannedStartAt).getTime() > now)
    .sort((a, b) => a.plannedStartAt.localeCompare(b.plannedStartAt));
  const rest = activities.filter((a) => !live.includes(a) && !upcoming.includes(a));
  return [...live, ...upcoming, ...rest].slice(0, PREVIEW_COUNT);
}

function keyDatePreview(keyDates: KeyDate[]): KeyDate[] {
  const pending = keyDates.filter((k) => !k.actualDate);
  const met = keyDates.filter((k) => k.actualDate);
  return [...pending, ...met].slice(0, PREVIEW_COUNT);
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View className="flex-row items-center justify-between pb-2 pt-5">
      <Text weight="bold" className="text-base">
        {title}
      </Text>
      {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          accessibilityRole="button"
          className="h-11 flex-row items-center gap-0.5 rounded-full px-2 active:bg-surface-alt"
        >
          <Text weight="semibold" tone="brand" className="text-[13px]">
            See all
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#004DE7" />
        </Pressable>
      ) : null}
    </View>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <View className="h-2 flex-1 overflow-hidden rounded-full bg-surface-alt">
      <View
        className="h-2 rounded-full bg-primary-500"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </View>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <View className="items-center py-6">
      <Text tone="secondary" className="text-[13px]">
        {text}
      </Text>
    </View>
  );
}

function HeroCard({ stages, keyDates }: { stages: Stage[]; keyDates: KeyDate[] }) {
  const stage = currentStage(stages);
  const upcoming = nextKeyDate(keyDates);
  const stageIndex = stage ? stages.filter((s) => s.sortOrder <= stage.sortOrder).length : 0;

  if (!stage && !upcoming) return null;

  return (
    <Card className="px-4 py-4">
      {stage ? (
        <>
          <Text tone="secondary" className="text-[11px] uppercase">
            Current stage · {stageIndex} of {stages.length}
          </Text>
          <Text weight="bold" className="pt-1 text-lg" numberOfLines={1}>
            {stage.name}
          </Text>
          <View className="flex-row items-center gap-3 pt-2.5">
            <ProgressBar percent={stage.progressPercent} />
            <Text weight="semibold" tone="brand" className="text-[13px]">
              {stage.progressPercent}%
            </Text>
          </View>
          {stage.dateRange ? (
            <Text tone="secondary" className="pt-1.5 text-xs">
              {stage.dateRange}
            </Text>
          ) : null}
        </>
      ) : null}

      {upcoming?.targetDate ? (
        <View className={`flex-row items-center gap-2 ${stage ? "mt-3 border-t border-hairline pt-3" : ""}`}>
          <Ionicons name="flag-outline" size={16} color="#004DE7" />
          <Text weight="semibold" className="min-w-0 flex-1 text-[13px]" numberOfLines={1}>
            {upcoming.label}
          </Text>
          {(() => {
            const days = daysFromToday(upcoming.targetDate);
            const late = days < 0;
            return (
              <View className={`rounded-full px-2 py-1 ${late ? "bg-error-50" : "bg-primary-50"}`}>
                <Text weight="semibold" tone={late ? "danger" : "brand"} className="text-[10px] uppercase">
                  {late ? `${-days}d late` : days === 0 ? "Today" : `In ${days}d`}
                </Text>
              </View>
            );
          })()}
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push("/tools/schedule/stages" as never)}
        accessibilityRole="button"
        className="mt-3 h-11 flex-row items-center justify-center gap-1 rounded-xl bg-surface-alt active:bg-hairline"
      >
        <Text weight="semibold" tone="secondary" className="text-[13px]">
          All build stages
        </Text>
        <Ionicons name="chevron-forward" size={14} color="#5C5C5C" />
      </Pressable>
    </Card>
  );
}

function LookAheadsSection({ db, projectId }: { db: Db; projectId: string }) {
  const { data, isPending } = useLocalLookAheads(db, projectId);

  return (
    <View>
      <SectionHeader title="Look aheads" onSeeAll={() => router.push("/tools/look-aheads" as never)} />
      {isPending ? (
        <EmptyNote text="Loading look aheads…" />
      ) : data.length === 0 ? (
        <Card>
          <EmptyNote text="Plan the next stretch of work so the crew knows what's coming." />
        </Card>
      ) : (
        <Card>
          {data.slice(0, PREVIEW_COUNT).map((lookAhead) => (
            <LookAheadRow
              key={lookAhead.id}
              lookAhead={lookAhead}
              onPress={() => router.push(`/tools/look-aheads/${lookAhead.id}` as never)}
            />
          ))}
        </Card>
      )}
      <Pressable
        onPress={() => router.push("/tools/look-aheads/new")}
        accessibilityRole="button"
        className="mt-2 min-h-11 flex-row items-center justify-center gap-1.5 self-start rounded-full bg-primary-50 px-4 active:bg-primary-100"
      >
        <Ionicons name="add" size={16} color="#004DE7" />
        <Text weight="semibold" tone="brand" className="text-xs">
          New look ahead
        </Text>
      </Pressable>
    </View>
  );
}

function Section({
  title,
  onSeeAll,
  isEmpty,
  emptyText,
  children,
}: {
  title: string;
  onSeeAll: () => void;
  isEmpty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <View>
      <SectionHeader title={title} onSeeAll={onSeeAll} />
      <Card>{isEmpty ? <EmptyNote text={emptyText} /> : children}</Card>
    </View>
  );
}

export default function Schedule() {
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const { data: project } = useProject(projectId);

  const activities = useActivities(projectId);
  const stages = useStages(projectId);
  const keyDates = useKeyDates(projectId);

  const isPending = activities.isPending && stages.isPending && keyDates.isPending;
  const isStale = activities.isStale || stages.isStale || keyDates.isStale;

  return (
    <Page
      title="Schedule"
      projectName={project?.name ?? "Loading project…"}
      onPressProject={() => router.push("/select-project")}
      rightButtons={
        <Pressable
          onPress={() => router.push("/tools/schedule/chart" as never)}
          accessibilityRole="button"
          accessibilityLabel="Project chart"
          className="h-11 w-11 items-center justify-center rounded-full active:bg-white/20"
        >
          <Ionicons name="stats-chart-outline" size={20} color="#FFFFFF" />
        </Pressable>
      }
    >
      {isPending ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : (
        <View className="pb-6">
          {isStale ? (
            <Text tone="muted" className="pb-2 text-xs">
              Showing your last synced data — you&apos;re offline.
            </Text>
          ) : null}

          <HeroCard stages={stages.data ?? []} keyDates={keyDates.data ?? []} />

          <Section
            title="Site activity"
            onSeeAll={() => router.push("/tools/schedule/activities" as never)}
            isEmpty={(activities.data ?? []).length === 0}
            emptyText="Site activities for this project will appear here."
          >
            {activityPreview(activities.data ?? []).map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </Section>

          {ready && db && projectId ? <LookAheadsSection db={db} projectId={projectId} /> : null}

          <Section
            title="Key dates"
            onSeeAll={() => router.push("/tools/schedule/key-dates" as never)}
            isEmpty={(keyDates.data ?? []).length === 0}
            emptyText="Milestone and compliance dates will appear here."
          >
            {keyDatePreview(keyDates.data ?? []).map((keyDate) => (
              <KeyDateRow key={keyDate.id} keyDate={keyDate} />
            ))}
          </Section>
        </View>
      )}
    </Page>
  );
}

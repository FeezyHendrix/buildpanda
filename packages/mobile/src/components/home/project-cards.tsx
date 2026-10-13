import { router } from "expo-router";
import { View } from "react-native";
import { PendingBadge, Text } from "@/components/atoms";
import { UpdateCard } from "@/components/molecules/update-card";
import type { Db } from "@/db/client";
import { useExpenses } from "@/hooks/use-expenses";
import { useKeyDates } from "@/hooks/use-key-dates";
import { useProject } from "@/hooks/use-projects";
import { useProjectUpdates } from "@/hooks/use-updates";
import { formatShortDate, localIsoDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { matchesStage } from "@/lib/stage-filter";
import { useStageScope } from "@/lib/stage-scope";
import { CardEmpty, CardRow, HomeCard } from "./home-card";

/** Progress and the next key dates — what the schedule means for this week. */
export function ScheduleCard({ projectId }: { projectId: string }) {
  const project = useProject(projectId);
  const dates = useKeyDates(projectId, true, null);
  const scope = useStageScope();
  const progress = scope.stageId ? scope.stage?.progressPercent : project.data?.progressPercent;
  const percent = typeof progress === "number" && Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : undefined;
  const upcoming = (dates.data ?? [])
    .filter((date) => !date.actualDate && date.targetDate &&
      matchesStage(date.linkedActivityId ? scope.activityStages.get(date.linkedActivityId) : undefined, scope.stageId))
    .sort((a, b) => a.targetDate!.localeCompare(b.targetDate!))
    .slice(0, 3);

  return (
    <HomeCard title={scope.stageId ? "Stage progress" : "Project progress"} subtitle={scope.stage?.name ?? project.data?.name} href="/(tabs)/schedule">
      <View className="flex-row items-end gap-3">
        <Text variant="heading" weight="bold" className="text-4xl">{percent === undefined ? "—" : `${Math.round(percent)}%`}</Text>
        <View className="mb-2 h-2 flex-1 overflow-hidden rounded-full bg-surface-alt" accessibilityRole="progressbar" accessibilityValue={percent === undefined ? undefined : { min: 0, max: 100, now: percent }}>
          <View className="h-2 rounded-full bg-primary-500" style={{ width: `${percent ?? 0}%` }} />
        </View>
      </View>
      <View className="pt-3">
        {upcoming.length === 0 ? (
          <CardEmpty>No upcoming key dates.</CardEmpty>
        ) : (
          upcoming.map((date) => (
            <CardRow key={date.id} title={date.label} meta={formatShortDate(date.targetDate!.slice(0, 10))} onPress={() => router.push(`/tools/schedule/key-dates/${date.id}` as never)} />
          ))
        )}
      </View>
    </HomeCard>
  );
}

export function ExpensesCard({ db, projectId }: { db: Db; projectId: string }) {
  const { data } = useExpenses(db, projectId);
  const project = useProject(projectId);
  const currency = project.data?.currency;
  const weekAgo = localIsoDate(new Date(Date.now() - 6 * 86_400_000));
  const thisWeek = data.filter((row) => row.transactedAt.slice(0, 10) >= weekAgo);
  const total = thisWeek.reduce((sum, row) => sum + (row.credit ? -row.amount : row.amount), 0);
  return (
    <HomeCard title="Expenses" subtitle={`${formatMoney(total, currency)} in the last 7 days`} href="/tools/expenses">
      {thisWeek.length === 0 ? (
        <CardEmpty>No expenses logged this week.</CardEmpty>
      ) : (
        thisWeek.slice(0, 3).map((row) => (
          <CardRow
            key={row.id}
            title={row.title}
            meta={[formatShortDate(row.transactedAt), row.categoryLabel || row.category].join(" · ")}
            trailing={
              <View className="items-end gap-1">
                <Text weight="semibold" className="text-sm">{row.credit ? "−" : ""}{formatMoney(row.amount, currency)}</Text>
                {row.isPendingSync ? <PendingBadge /> : null}
              </View>
            }
          />
        ))
      )}
    </HomeCard>
  );
}

export function UpdatesCard({ projectId }: { projectId: string }) {
  const updates = useProjectUpdates(projectId);
  const latest = (updates.data ?? []).slice(0, 2);
  return (
    <HomeCard title="Recent updates" href="/tools/updates">
      {latest.length === 0 ? (
        <CardEmpty>{updates.error ? "Updates are unavailable. Try again when connected." : "No updates yet."}</CardEmpty>
      ) : (
        <View className="gap-3">
          {latest.map((update) => <UpdateCard key={update.id} update={update} onPress={() => router.push(`/tools/updates/${update.id}` as never)} />)}
        </View>
      )}
    </HomeCard>
  );
}

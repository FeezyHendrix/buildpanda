import { withProjectPermission } from "@/components/molecules/permission-gate";
import { goBack } from "@/lib/navigation";
import Ionicons from "@/components/atoms/icon";
import { router } from "@/navigation";
import { PendingBadge, Spinner, Text } from "@/components/atoms";
import { ICON_BRAND, ICON_FAINT } from "@/constants/colors";
import { UnassignedLogs } from "@/components/molecules/unassigned-logs";
import { Page } from "@/components/molecules/page";
import { SearchableList } from "@/components/molecules/searchable-list";
import type { Db } from "@/db/client";
import { todayIso } from "@/db/daily-logs-repository";
import { useLocalDb } from "@/db/provider";
import { useDailyLogDays } from "@/hooks/use-daily-logs";
import { formatDayLabel } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
import { useProjectAccess } from "@/lib/project-access-provider";
import { features } from "@/lib/feature-access";
function DayList({ db, projectId }: {
    db: Db;
    projectId: string;
}) {
    const { data, isPending } = useDailyLogDays(db, projectId);
    const today = todayIso();
    const hasToday = data.some((d) => d.logDate === today);
    const { allows } = useProjectAccess();
    return (<SearchableList data={data} loading={isPending} fields={(day) => [
            day.logDate,
            formatDayLabel(day.logDate),
            day.summary,
            day.logDate === today ? "Today" : "",
        ]} placeholder="Search logs by date or summary" emptyTitle="No logs yet" emptyBody="A daily log records weather, crew and what happened on site." header={<>
          <UnassignedLogs db={db} projectId={projectId}/>
          {!hasToday && allows(features.dailyLog.actions.create) ? (<button onClick={() => router.push(`/tools/daily-log/new?date=${today}`)} role="button" className="mb-3 min-h-16 flex-row items-center gap-3 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 active:bg-primary-100" type="button">
              <Ionicons name="add-circle-outline" size={22} color={ICON_BRAND}/>
              <div className="field-stack flex-1">
                <Text weight="semibold" tone="brand" className="text-[15px]">
                  Start today&apos;s log
                </Text>
                <Text tone="secondary" className="pt-0.5 text-xs">
                  {formatDayLabel(today)}
                </Text>
              </div>
            </button>) : null}
        </>} renderItem={(day) => (<button key={day.id} onClick={() => router.push(`/tools/daily-log/${day.logDate}`)} role="button" className="min-h-16 flex-row items-center gap-3 border-b border-hairline px-4 py-3 active:bg-surface-alt" type="button">
          <div className="field-stack min-w-0 flex-1">
            <Text weight="semibold" className="text-[15px]">
              {formatDayLabel(day.logDate) || day.logDate}
              {day.logDate === today ? " · Today" : ""}
            </Text>
            <Text tone="secondary" className="pt-0.5 text-xs">
              {day.totalHours}h logged
            </Text>
          </div>

          {day.isVoided ? (<div className="field-stack rounded-full bg-surface-alt px-2 py-1">
              <Text weight="semibold" tone="secondary" className="text-[10px] uppercase">
                Void
              </Text>
            </div>) : day.isPendingSync ? (<PendingBadge />) : null}
          <Ionicons name="chevron-forward" size={18} color={ICON_FAINT}/>
        </button>)}/>);
}
function DailyLogIndex() {
    const { projectId } = useFieldSession();
    const { db, ready } = useLocalDb();
    return (<Page stageScope scroll={false} buildingScope title="Daily log" onBack={() => goBack()}>
      {ready && db && projectId ? (<DayList key={projectId} db={db} projectId={projectId}/>) : (<div className="field-stack items-center py-12">
          <Spinner size="md"/>
        </div>)}
    </Page>);
}
export default withProjectPermission(DailyLogIndex, "/tools/daily-log");

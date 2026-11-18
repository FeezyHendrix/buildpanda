import { Scroller } from "@/components/atoms/scroller";
import { withProjectPermission } from "@/components/molecules/permission-gate";
import { useProjectBuilding } from "@/hooks/use-project-building";
import { isIsoDate } from "@/lib/dates";
import { todayIso } from "@/db/daily-logs-repository";
import { goBack } from "@/lib/navigation";
import Ionicons from "@/components/atoms/icon";
import { useLocalSearchParams } from "@/navigation";
import { useState } from "react";
import type { Activity } from "@/api/activities";
import { Button, Card, Field, OptionRow, Spinner, Text } from "@/components/atoms";
import { ICON_BRAND, ICON_FAINT, ICON_SUBTLE } from "@/constants/colors";
import { Page } from "@/components/molecules/page";
import { dailyLogsRepository } from "@/db/daily-logs-repository";
import { flushOutbox } from "@/db/outbox";
import { useLocalDb } from "@/db/provider";
import { useActivities, useDelayReasons } from "@/hooks/use-activities";
import { useFieldSession } from "@/lib/field-session";
import { cn } from "@/lib/utils";
// Logging an activity against a day is authoring a record, so it is a page.
// It used to be a bottom sheet, which this package's rule reserves for
// switching context or a short confirmation.
function LogActivityForm() {
    const { date } = useLocalSearchParams<{
        date?: string;
    }>();
    const { projectId } = useFieldSession();
    const { db, ready } = useLocalDb();
    const { buildingId } = useProjectBuilding();
    const activities = useActivities(projectId);
    const delayReasons = useDelayReasons();
    const [selected, setSelected] = useState<Activity | null>(null);
    const [hours, setHours] = useState("");
    const [delayed, setDelayed] = useState(false);
    const [reasonCode, setReasonCode] = useState<string | null>(null);
    const [delayNote, setDelayNote] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const logDate = date ?? todayIso();
    const hoursNumber = Number(hours.trim());
    const canLog = Boolean(selected && db && projectId) && isIsoDate(logDate) &&
        hours.trim().length > 0 && Number.isFinite(hoursNumber) && hoursNumber > 0 &&
        (!delayed || Boolean(reasonCode)) && !saving;
    async function handleLog() {
        if (!canLog || !selected || !db || !projectId)
            return;
        setSaving(true);
        setError(null);
        try {
            await dailyLogsRepository.logActivityLocal(db, projectId, logDate, {
                activityId: selected.id,
                buildingId: selected.buildingId ?? buildingId,
                activityName: selected.name,
                hoursLogged: hoursNumber,
                delayReasonCode: delayed ? reasonCode : null,
                delayNote: delayed && delayNote.trim() ? delayNote.trim() : null,
            });
            void flushOutbox(db).catch(() => undefined);
            goBack();
        }
        catch (err) {
            console.error("log activity failed", err);
            setError(err instanceof Error && err.message ? err.message : "Couldn't log that activity.");
            setSaving(false);
        }
    }
    const list = (activities.data ?? []) as Activity[];
    return (<Page buildingScope title={selected ? "Log hours" : "Pick an activity"} onBack={() => (selected ? setSelected(null) : goBack())} scroll={false} footer={selected ? (<div className="field-stack gap-2">
            {error ? (<Text tone="danger" className="px-1 text-xs">
                {error}
              </Text>) : null}
            <Button onPress={handleLog} loading={saving} disabled={!canLog}>
              Log activity
            </Button>
          </div>) : undefined}>
      {!ready || activities.isPending ? (<div className="field-stack items-center py-12">
          <Spinner size="md"/>
        </div>) : !selected ? (<ActivityPicker list={list} onPick={setSelected}/>) : (<Scroller contentContainerClassName="gap-4 pb-4" keyboardShouldPersistTaps="handled">
          <div className="field-stack rounded-xl bg-surface-alt px-4 py-3">
            <Text weight="semibold" className="text-[15px]">
              {selected.name}
            </Text>
            {selected.phaseName ? (<Text tone="secondary" className="pt-0.5 text-xs">
                {selected.phaseName}
              </Text>) : null}
          </div>

          <Field label="Hours worked" value={hours} onChangeText={setHours} keyboardType="numeric" placeholder="0" autoFocus/>

          <button onClick={() => setDelayed((v) => !v)} role="checkbox" aria-checked={delayed} className="min-h-11 flex-row items-center gap-3" type="button">
            <Ionicons name={delayed ? "checkbox" : "square-outline"} size={22} color={delayed ? ICON_BRAND : ICON_SUBTLE}/>
            <Text weight="semibold" className="text-[15px]">
              Work was delayed
            </Text>
          </button>

          {delayed ? (<div className="field-stack gap-3 pl-8">
              <OptionRow label="Reason" options={(delayReasons.data ?? []).map((reason) => ({ value: reason.code, label: reason.name }))} value={reasonCode ?? ""} onChange={setReasonCode}/>
              <Field label="Note (optional)" value={delayNote} onChangeText={setDelayNote} placeholder="What happened?" multiline className="min-h-20"/>
            </div>) : null}
        </Scroller>)}
    </Page>);
}
function ActivityPicker({ list, onPick }: {
    list: Activity[];
    onPick: (activity: Activity) => void;
}) {
    if (list.length === 0) {
        return (<div className="field-stack items-center py-12">
        <Text weight="semibold" className="text-center text-base">
          No activities yet
        </Text>
        <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
          Activities come from this project&apos;s programme. Ask your project manager to add one.
        </Text>
      </div>);
    }
    return (<Scroller contentContainerClassName="pb-4">
      <Card>
        {list.map((activity) => (<button key={activity.id} onClick={() => onPick(activity)} role="button" className="min-h-14 flex-row items-center gap-3 border-b border-hairline px-4 py-3 active:bg-surface-alt" type="button">
            <div className="field-stack min-w-0 flex-1">
              <Text weight="semibold" className="text-[15px]" numberOfLines={1}>
                {activity.name}
              </Text>
              {activity.phaseName ? (<Text tone="secondary" className="text-xs" numberOfLines={1}>
                  {activity.phaseName}
                </Text>) : null}
            </div>
            <div className={"field-stack " + (cn("rounded-full px-2 py-0.5", activity.isDelayed ? "bg-error-50" : "bg-surface-alt"))}>
              <Text weight="semibold" tone={activity.isDelayed ? "danger" : "secondary"} className="text-[10px] uppercase">
                {activity.isDelayed ? "Delayed" : activity.status}
              </Text>
            </div>
            <Ionicons name="chevron-forward" size={18} color={ICON_FAINT}/>
          </button>))}
      </Card>
    </Scroller>);
}
function LogActivity() {
    const { projectId } = useFieldSession();
    const { buildingId } = useProjectBuilding();
    return <LogActivityForm key={`${projectId}:${buildingId}`}/>;
}
export default withProjectPermission(LogActivity, "/tools/daily-log/log-activity");

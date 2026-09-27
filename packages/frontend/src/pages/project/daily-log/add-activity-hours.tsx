import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { ComboSelect, type ComboItem } from "@/components/molecules/combo-select";
import { useProjectActivities } from "@/hooks/use-activities";
import { useLinkDailyLogActivity } from "@/hooks/use-daily-logs";
import { errorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import type { Activity } from "@/lib/project-types";

interface AddActivityHoursProps {
  projectId: string;
  logDate: string;
  /** Activity ids already linked to this day — offered first for correction. */
  linkedIds: readonly string[];
}

/** An activity is "on site" that day when the day falls inside its planned span. */
function plannedAcross(activity: Activity, logDate: string): boolean {
  const start = activity.plannedStartAt.slice(0, 10);
  const end = activity.plannedEndAt.slice(0, 10);
  return start <= logDate && logDate <= end;
}

function toItems(activities: readonly Activity[], logDate: string, linkedIds: readonly string[]): ComboItem[] {
  const linked = new Set(linkedIds);
  const items: ComboItem[] = [];
  for (const activity of activities) {
    if (activity.isSummary) continue;
    const onSite = plannedAcross(activity, logDate);
    if (!onSite && !linked.has(activity.id)) continue;
    items.push({
      id: activity.id,
      label: activity.phaseName ? `${activity.name} · ${activity.phaseName}` : activity.name,
      group: onSite ? "Planned across this day" : "Already logged",
    });
  }
  return items;
}

/**
 * The hours a crew put into an activity on a given day. The backend route and
 * the link hook already existed; nothing in the UI called them (finding F2), so
 * the plan's "activities linked with hours" was impossible from the app.
 */
function AddActivityHours({ projectId, logDate, linkedIds }: AddActivityHoursProps) {
  const [activityId, setActivityId] = useState<string | null>(null);
  const [hours, setHours] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [postUpdate, setPostUpdate] = useState(false);
  const { data: activities = [] } = useProjectActivities(projectId);
  const link = useLinkDailyLogActivity();

  const scoped = useMemo(() => toItems(activities, logDate, linkedIds), [activities, logDate, linkedIds]);
  const all = useMemo<ComboItem[]>(
    () =>
      activities
        .filter((activity) => !activity.isSummary)
        .map((activity) => ({
          id: activity.id,
          label: activity.phaseName ? `${activity.name} · ${activity.phaseName}` : activity.name,
        })),
    [activities],
  );
  const items = showAll ? all : scoped;

  const parsedHours = Number(hours);
  const canSubmit = Boolean(activityId) && Number.isFinite(parsedHours) && parsedHours > 0;

  function submit(): void {
    if (!canSubmit || !activityId) return;
    link.mutate(
      { projectId, logDate, activityId, hoursLogged: parsedHours, postUpdate },
      {
        onSuccess: () => {
          setActivityId(null);
          setHours("");
          toast("Activity hours logged", "success");
        },
      },
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-line-hair bg-surface-alt p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="activity-hours-picker">Activity</Label>
          <ComboSelect
            items={items}
            value={activityId}
            onChange={setActivityId}
            placeholder={items.length === 0 ? "Nothing planned across this day" : "Choose an activity…"}
            searchPlaceholder="Search activities…"
            emptyText="No activities match"
            className="bg-white"
          />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-28">
          <Label htmlFor="activity-hours">Hours</Label>
          <input
            id="activity-hours"
            type="number"
            min={0}
            step="any"
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <Button type="button" size="md" disabled={!canSubmit} loading={link.isPending} onClick={submit}>
          Add hours
        </Button>
      </div>

      <label className="flex items-start gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={postUpdate}
          onChange={(event) => setPostUpdate(event.target.checked)}
          className="mt-0.5"
        />
        Also post this to the client Updates feed (off by default — logging hours is
        a diary entry, not a stakeholder update).
      </label>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {showAll
            ? "Showing every activity on the project."
            : "Showing activities planned across this day."}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((current) => !current)}>
          {showAll ? "Only this day's activities" : "Show all activities"}
        </Button>
      </div>

      {link.error ? (
        <p className="rounded-lg bg-negative-50 px-3 py-2 text-xs text-negative-600">
          {errorMessage(link.error)}
        </p>
      ) : null}
    </div>
  );
}

AddActivityHours.displayName = "AddActivityHours";

export { AddActivityHours, type AddActivityHoursProps };

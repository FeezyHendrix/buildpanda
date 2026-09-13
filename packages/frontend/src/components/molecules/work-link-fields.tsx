import { useMemo } from "react";
import { Label } from "@/components/atoms/label";
import { ComboSelect, type ComboItem } from "@/components/molecules/combo-select";
import { useProjectActivities } from "@/hooks/use-activities";
import { useStages } from "@/hooks/use-stages";
import type { Activity, Stage } from "@/lib/project-types";

const UNLINKED = "__none__";

/**
 * A procurement record is only useful to the programme when it names the work
 * it unlocks: the stage carries the cost, the activity is what a late delivery
 * actually delays. The activity list narrows to the chosen stage so a grader
 * cannot be booked against an activity in another phase.
 */
export interface WorkLinkValue {
  phaseId: string | null;
  activityId: string | null;
}

interface WorkLinkFieldsProps {
  projectId: string;
  /** Only fetch while the drawer is open. */
  enabled: boolean;
  value: WorkLinkValue;
  onChange: (value: WorkLinkValue) => void;
  idPrefix: string;
}

function stageItems(stages: readonly Stage[]): ComboItem[] {
  return [
    { id: UNLINKED, label: "Not linked to a stage" },
    ...stages.map((stage) => ({ id: stage.id, label: stage.name })),
  ];
}

function activityItems(activities: readonly Activity[]): ComboItem[] {
  return [
    { id: UNLINKED, label: "Not linked to an activity" },
    ...activities.map((activity) => ({
      id: activity.id,
      label: activity.name,
      group: activity.phaseName ?? undefined,
    })),
  ];
}

export function WorkLinkFields({
  projectId,
  enabled,
  value,
  onChange,
  idPrefix,
}: WorkLinkFieldsProps) {
  const scopedProjectId = enabled ? projectId : undefined;
  const { data: stages = [] } = useStages(scopedProjectId);
  const { data: activities = [] } = useProjectActivities(scopedProjectId);

  // Summary bars are headings on the programme, not work anyone books against.
  const selectable = useMemo(
    () =>
      activities.filter(
        (activity) =>
          !activity.isSummary && (!value.phaseId || activity.phaseId === value.phaseId),
      ),
    [activities, value.phaseId],
  );

  const stageOptions = useMemo(() => stageItems(stages), [stages]);
  const activityOptions = useMemo(() => activityItems(selectable), [selectable]);

  function pickStage(next: string | null): void {
    const phaseId = next && next !== UNLINKED ? next : null;
    // Dropping the activity keeps the pair honest when the stage changes under it.
    const stillValid =
      value.activityId !== null &&
      activities.some(
        (activity) =>
          activity.id === value.activityId && (!phaseId || activity.phaseId === phaseId),
      );
    onChange({ phaseId, activityId: stillValid ? value.activityId : null });
  }

  function pickActivity(next: string | null): void {
    const activityId = next && next !== UNLINKED ? next : null;
    const activity = activities.find((item) => item.id === activityId);
    // Picking the activity first fills the stage in rather than leaving a half link.
    onChange({
      activityId,
      phaseId: activity?.phaseId ?? value.phaseId,
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-stage`}>Stage</Label>
        <ComboSelect
          items={stageOptions}
          value={value.phaseId ?? UNLINKED}
          onChange={pickStage}
          placeholder="Which stage pays for this?"
          searchPlaceholder="Search stages…"
          emptyText="No stages on this project"
          id={`${idPrefix}-stage`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-activity`}>Site activity</Label>
        <ComboSelect
          items={activityOptions}
          value={value.activityId ?? UNLINKED}
          onChange={pickActivity}
          placeholder={value.phaseId ? "Activity in this stage" : "Which activity does it unlock?"}
          searchPlaceholder="Search activities…"
          emptyText={value.phaseId ? "No activities in this stage" : "No activities yet"}
          id={`${idPrefix}-activity`}
        />
      </div>
    </div>
  );
}

WorkLinkFields.displayName = "WorkLinkFields";

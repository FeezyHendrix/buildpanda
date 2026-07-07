import { Badge } from "@/components/atoms/badge";
import type { ProgrammePhase, ProgrammeActivity } from "@/hooks/use-programme-import";

export function PhasePreview({
  phase,
  activities,
}: {
  phase: ProgrammePhase;
  activities: ProgrammeActivity[];
}) {
  const phaseActivities = activities.filter((a) => a.phaseKey === phase.key);
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {phase.name}
      </p>
      <div className="space-y-1">
        {phaseActivities.map((activity) => (
          <ActivityPreview key={activity.refId} activity={activity} />
        ))}
      </div>
    </div>
  );
}

function ActivityPreview({ activity }: { activity: ProgrammeActivity }) {
  const indent = Math.max(0, activity.outlineLevel - 1) * 12;
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#FAFAFA] px-3 py-2 text-sm" style={{ paddingLeft: 12 + indent }}>
      <span className={activity.isSummary ? "truncate font-semibold text-gray-900" : "truncate text-gray-900"}>
        {activity.wbsCode ? `${activity.wbsCode} ` : ""}{activity.name}
      </span>
      <span className="ml-3 flex shrink-0 items-center gap-2 text-xs text-gray-500">
        {formatRange(activity.startAt, activity.endAt)}
        {activity.isSummary ? (
          <Badge tone="neutral" size="sm">
            Summary
          </Badge>
        ) : null}
        {activity.isMilestone ? (
          <Badge tone="warning" size="sm">
            Milestone
          </Badge>
        ) : null}
        {activity.predecessors.length > 0 ? (
          <span className="text-gray-400">· {activity.predecessors.length} deps</span>
        ) : null}
      </span>
    </div>
  );
}

function formatRange(start: string, end: string): string {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB");
  return `${fmt(start)} – ${fmt(end)}`;
}

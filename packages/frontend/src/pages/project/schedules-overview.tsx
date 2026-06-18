import { useMemo, useState } from "react";
import { ReactSVG } from "react-svg";
import { Card } from "@/components/atoms/card";
import { Badge } from "@/components/atoms/badge";
import { PageHeader } from "@/components/molecules/page-header";
import { ActivityDetailModal } from "@/components/molecules/activity-detail-modal";
import { useProjectContext } from "@/layouts/project-layout";
import { useStages } from "@/hooks/use-stages";
import { useProjectActivities } from "@/hooks/use-activities";
import { icons } from "@/assets/icons/icons";
import { cn } from "@/lib/utils";
import type { Activity, ActivityStatus, Stage, StageStatus } from "@/lib/project-types";
import { ProgressBar } from "@/components";
import { ac } from "@/lib/permissions";
import { formatLongDate } from "@/lib/formatters";

// ── Status meta ───────────────────────────────────────────────────────────────
const STAGE_STATUS_META: Record<
  StageStatus,
  { label: string; tone: "neutral" | "info" | "success"; dotColor: string }
> = {
  Pending:    { label: "Not Started", tone: "neutral", dotColor: "#C0C0C0" },
  InProgress: { label: "In Progress", tone: "info",    dotColor: "#004DE7" },
  Done:       { label: "Complete",    tone: "success",  dotColor: "#1B8E45" },
};

const ACTIVITY_STATUS_META: Record<
  ActivityStatus,
  { label: string; tone: "neutral" | "info" | "success" | "danger" }
> = {
  Planned:    { label: "Planned",     tone: "neutral"  },
  InProgress: { label: "In Progress", tone: "info"     },
  Completed:  { label: "Completed",    tone: "success"  },
  Cancelled:  { label: "Cancelled",   tone: "danger"   },
};

function activityProgressPct(status: ActivityStatus): number {
  if (status === "Completed")  return 100;
  if (status === "InProgress") return 65;
  return 0;
}

// ── KPI stat card ─────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  progress,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  progress?: number;
  icon: string;
}) {
  return (
    <Card padding="md" className="flex flex-col gap-3 rounded-[12px] border-none bg-white flex-1">
      <div className="flex items-center gap-2">
        <ReactSVG src={icon} className="shrink-0" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      </div>
      <div>
        <p className="text-[20px] font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="mt-0.5 text-[12px] text-gray-400">{sub}</p>}
        {progress !== undefined && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#EDEDED]">
            <div
              className="h-full rounded-full bg-[#004DE7] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Activity row inside an expanded stage ─────────────────────────────────────
function ActivityRow({
  activity,
  onViewDetails,
}: {
  activity: Activity;
  onViewDetails: (a: Activity) => void;
}) {
  const meta = ACTIVITY_STATUS_META[activity.status];
  const pct  = activityProgressPct(activity.status);

  return (
    <div className="flex flex-col gap-4 rounded-[12px] border border-[#F6F6F6] bg-white p-4 w-[360px]">
      <div className="min-w-0 flex flex-col flex-1 gap-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[13px] font-medium text-black-500">{activity.name}</p>
          <Badge tone={meta.tone} size="sm">{meta.label}</Badge>
        </div>

        <div className="flex flex-col gap-2">
          <div className='flex justify-between'>
            <span className="text-[11px] tabular-nums text-black-500">{activity.percentComplete}% Complete</span>
            <span className="text-[11px] tabular-nums text-black-300">{activity.percentComplete === 100 ? 'Closed' : 'Finish'}: {activity.actualEndAt ? formatLongDate(activity.actualEndAt) : 'N/A'}</span>
          </div>
          <ProgressBar
            tone={activity.percentComplete === 100 ? "success" : "brand"}
            value={activity.percentComplete}
            trackClassName="bg-primary-50"
          />

        </div>
        <div className="p-4 bg-[#F6F6F6] rounded-[8px]">
          <p className="text-[11px] tabular-nums text-black-500 font-semibold">Latest Update</p>
          <p className='text-[#434655] text-[11px]'>{activity.notes || 'N/A'}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onViewDetails(activity)}
        className="shrink-0 w-full rounded-[8px] border border-[#F6F6F6] px-[8px] py-[10px] text-[12px] font-semibold text-black-500 transition-colors"
      >
        View Details
      </button>
    </div>
  );
}

// ── Phase / stage accordion row ───────────────────────────────────────────────
function StageRow({
  stage,
  activities,
  onViewDetails,
  defaultOpen,
}: {
  stage: Stage;
  activities: Activity[];
  onViewDetails: (a: Activity) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const meta = STAGE_STATUS_META[stage.status];

  return (
    <div className="overflow-hidden rounded-[8px] border border-[#F6F6F6] p-5">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-4 text-left transition-colors"
      >
        {/* Status dot */}
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: meta.dotColor }}
        />
        <span className="flex-1 text-[14px] font-semibold text-gray-900">{stage.name}</span>

        {/* Chevron */}
        <svg
          className={cn("size-4 shrink-0 text-gray-400 transition-transform duration-200", open && "rotate-180")}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Expanded activities */}
      {open && (
        <div className="flex gap-2 py-4">
          {activities.length === 0 ? (
            <p className="text-[13px] text-gray-400">No activities for this phase.</p>
          ) : (
            activities.map((a) => (
              <ActivityRow key={a.id} activity={a} onViewDetails={onViewDetails} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SchedulesOverview() {
  const { project } = useProjectContext();
  const { data: stages = [], isLoading: stagesLoading } = useStages(project.id);
  const { data: activities = [] } = useProjectActivities(project.id);

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function openDetail(a: Activity) {
    setSelectedActivity(a);
    setModalOpen(true);
  }

  // Group activities by phaseName → match against stage name
  const activitiesByStage = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of activities) {
      const key = a.phaseName ?? "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [activities]);

  // KPI derivations
  const actualProgress = useMemo(() => {
    if (!stages.length) return 0;
    return Math.round(stages.reduce((s, st) => s + st.progressPercent, 0) / stages.length);
  }, [stages]);

  const nextPhase = stages.find((s) => s.status === "Pending");
  const inProgressStage = stages.find((s) => s.status === "InProgress");

  const doneCount = stages.filter((s) => s.status === "Done").length;

  if (stagesLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#004DE7]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Schedules"
        description="Stay in control with real-time updates on progress, payments, and site activity."
      />

      {/* ── KPI bar ── */}
      <div className="mt-6 flex flex-wrap gap-3">
        <StatCard
          label="Construction Progress"
          value={`${project.progressPercent}%`}
          progress={project.progressPercent}
          icon={icons.constructionProgress}
        />
        <StatCard
          label="Actual Progress"
          value={`${actualProgress}%`}
          progress={actualProgress}
          icon={icons.trendingUp}
        />
        <StatCard
          label="Next Phase"
          value={nextPhase?.name ?? "—"}
          sub={nextPhase?.dateRange ?? undefined}
          icon={icons.calendarSearch}
        />
        <StatCard
          label="Phases Complete"
          value={`${doneCount} / ${stages.length}`}
          sub={inProgressStage ? `In progress: ${inProgressStage.name}` : undefined}
          icon={icons.hourglass}
        />
        <StatCard
          label="Active Work Items"
          value={String(activities.filter((a) => a.status === "InProgress").length)}
          sub={`${activities.filter((a) => a.isDelayed).length} delayed`}
          icon={icons.warningCircle}
        />
      </div>

      {/* ── Programme Timeline ── */}
      <div className="mt-10">
        <div className="flex items-center gap-2 py-4">
          <h2 className="text-[16px] font-semibold text-black-500">Programme Timeline</h2>
        </div>

        <div className="m-1 rounded-[12px] bg-white">
          {stages.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No stages found for this project.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stages.map((stage, idx) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  activities={activitiesByStage.get(stage.name) ?? []}
                  onViewDetails={openDetail}
                  defaultOpen={stage.status === "InProgress" || idx === 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Activity detail modal ── */}
      <ActivityDetailModal
        activity={selectedActivity}
        open={modalOpen}
        onOpenChange={(o) => {
          setModalOpen(o);
          if (!o) setSelectedActivity(null);
        }}
      />
    </div>
  );
}

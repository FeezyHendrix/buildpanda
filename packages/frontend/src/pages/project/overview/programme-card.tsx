import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { Spinner } from "@/components/atoms/spinner";
import { HealthTrendChart } from "@/components/organisms/charts/health-trend-chart";
import { useKeyDates } from "@/hooks/use-key-dates";
import { useReportingSnapshot, type PhaseRef } from "@/hooks/use-reporting-snapshot";
import { formatShortDate } from "@/lib/formatters";
import type { KeyDate, Project } from "@/lib/project-types";
import { TimelineStepper } from "./timeline-stepper";

const UPCOMING_KEY_DATE_LIMIT = 3;
const MS_PER_DAY = 86_400_000;

interface UpcomingKeyDate {
  keyDate: KeyDate;
  daysUntil: number;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Open key dates from today onward, soonest first. */
function nextKeyDates(keyDates: KeyDate[], today: number): UpcomingKeyDate[] {
  return keyDates
    .flatMap((keyDate) => {
      if (keyDate.actualDate || !keyDate.targetDate) return [];
      const target = new Date(keyDate.targetDate).getTime();
      if (Number.isNaN(target) || target < today) return [];
      return [{ keyDate, daysUntil: Math.round((target - today) / MS_PER_DAY) }];
    })
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, UPCOMING_KEY_DATE_LIMIT);
}

function dueLabel(days: number): string {
  if (days === 0) return "Due today";
  return `Due in ${days} ${days === 1 ? "day" : "days"}`;
}

function PhaseRow({ phase }: { phase: PhaseRef }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="truncate font-medium text-black-500">{phase.name}</span>
        <span className="shrink-0 tabular-nums text-black-300">{Math.round(phase.progressPercent)}%</span>
      </div>
      <ProgressBar value={phase.progressPercent} size="sm" />
    </li>
  );
}

function KeyDateRow({ item }: { item: UpcomingKeyDate }) {
  return (
    <li className="flex items-center justify-between gap-3 text-[13px]">
      <div className="min-w-0">
        <p className="truncate font-medium text-black-500">{item.keyDate.label}</p>
        <p className="text-[12px] text-black-300">{formatShortDate(item.keyDate.targetDate)}</p>
      </div>
      <Badge tone={item.daysUntil <= 7 ? "warning" : "neutral"} size="sm" className="shrink-0">
        {dueLabel(item.daysUntil)}
      </Badge>
    </li>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-black-300">{children}</p>;
}

export function ProgrammeCard({ project, className }: { project: Project; className?: string }) {
  const snapshot = useReportingSnapshot(project.id);
  const keyDates = useKeyDates(project.id);
  const inProgress = snapshot.data?.schedule.phasesInProgress ?? [];
  const upcoming = nextKeyDates(keyDates.data ?? [], startOfToday());
  const healthPoints = snapshot.data?.health.trendOldestFirst ?? [];
  const isPending = snapshot.isPending || keyDates.isPending;

  return (
    <Card data-tour="construction-timeline" className={className}>
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <h3 className="text-[13px] font-semibold text-black-300">Programme</h3>
        </div>
        <Link
          to={`/project/${project.id}/project-chart`}
          className="text-xs font-semibold text-[#004DE7] hover:underline"
        >
          View Detailed Gantt
        </Link>
      </div>
      <div className="h-full flex flex-col gap-5 px-5 pb-5">
        <div className="overflow-x-auto">
          <div className="min-w-[480px]">
            <TimelineStepper phases={project.timeline} />
          </div>
        </div>

        {isPending ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : (
          <>
            {inProgress.length > 0 ? (
              <section className="flex flex-col gap-3">
                <SectionTitle>In progress</SectionTitle>
                <ul className="flex flex-col gap-3">
                  {inProgress.map((phase) => (
                    <PhaseRow key={phase.id} phase={phase} />
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="flex flex-col gap-3">
              <SectionTitle>Next key dates</SectionTitle>
              {upcoming.length === 0 ? (
                <p className="text-[13px] text-black-300">No upcoming key dates.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {upcoming.map((item) => (
                    <KeyDateRow key={item.keyDate.id} item={item} />
                  ))}
                </ul>
              )}
            </section>

            {healthPoints.length >= 2 ? (
              <section className="flex flex-col gap-2">
                <SectionTitle>Health trend</SectionTitle>
                <HealthTrendChart points={healthPoints} compact />
              </section>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}

ProgrammeCard.displayName = "ProgrammeCard";

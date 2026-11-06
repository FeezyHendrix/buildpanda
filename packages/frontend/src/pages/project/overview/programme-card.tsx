import { Spinner } from "@/components/atoms/spinner";
import { useKeyDates } from "@/hooks/use-key-dates";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { formatShortDate } from "@/lib/formatters";
import type { KeyDate, Project } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { CardHeaderLink, OverviewCard, SectionEyebrow } from "./overview-card";
import { CompletionPosition } from "./completion-position";
import { TimelineStepper } from "./timeline-stepper";

const UPCOMING_KEY_DATE_LIMIT = 5;
const MS_PER_DAY = 86_400_000;
/** A key date this close reads as urgent. */
const URGENT_WITHIN_DAYS = 7;

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

function KeyDateRow({ item }: { item: UpcomingKeyDate }) {
  const urgent = item.daysUntil <= URGENT_WITHIN_DAYS;
  return (
    <li className="flex items-center justify-between gap-3 border-b border-[#EEEEEE] py-[10px] last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold leading-[16px] text-[#1E1E1E]">{item.keyDate.label}</p>
        <p className="text-[12px] leading-[16px] text-[#737373]">{formatShortDate(item.keyDate.targetDate)}</p>
      </div>
      <span
        className={cn(
          "inline-flex h-[22px] shrink-0 items-center rounded-full border px-[9px] text-[12px] leading-[16px]",
          urgent ? "border-[#FFE7A8] bg-[#FFF8E6] text-[#E17100]" : "border-[#EEEEEE] bg-white text-[#1E1E1E]",
        )}
      >
        {dueLabel(item.daysUntil)}
      </span>
    </li>
  );
}

export function ProgrammeCard({ project, className }: { project: Project; className?: string }) {
  const snapshot = useReportingSnapshot(project.id);
  const keyDates = useKeyDates(project.id);
  const upcoming = nextKeyDates(keyDates.data ?? [], startOfToday());
  const isPending = snapshot.isPending || keyDates.isPending;

  return (
    <OverviewCard
      data-tour="construction-timeline"
      title="Programme Of Works"
      className={className}
      action={<CardHeaderLink to={`/project/${project.id}/schedules/project-chart`}>View Gantt Chart</CardHeaderLink>}
    >
      <div className="border-b border-[#EEEEEE] pb-[26px] pt-[26px]">
        <TimelineStepper phases={project.timeline} />
      </div>

      {isPending ? (
        <div className="flex min-h-[120px] flex-1 items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : (
        <>
          <CompletionPosition
            schedule={snapshot.data?.schedule}
            currency={project.currency ?? "NGN"}
            className="mx-[14px] mt-[14px]"
          />
          <section className="px-[14px] pb-[6px] pt-[16px]">
            <SectionEyebrow>Next key dates</SectionEyebrow>
            {upcoming.length === 0 ? (
              <p className="py-[14px] text-[13px] text-[#737373]">No upcoming key dates.</p>
            ) : (
              <ul className="mt-[4px] flex flex-col">
                {upcoming.map((item) => (
                  <KeyDateRow key={item.keyDate.id} item={item} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </OverviewCard>
  );
}

ProgrammeCard.displayName = "ProgrammeCard";

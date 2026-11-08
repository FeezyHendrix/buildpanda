import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PhaseStatus, ProjectPhase } from "@/lib/project-types";

/** "12 Nov 2026 – 11 Dec 2026" → two ends; anything else (template ranges) stays one string. */
const RANGE_SPLIT = /\s[–-]\s|\s+to\s+/;

function formatDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function splitRange(dateRange: string): [string, string] | null {
  const parts = dateRange.split(RANGE_SPLIT).map((part) => part.trim());
  return parts.length === 2 && parts[0] && parts[1] ? [parts[0], parts[1]] : null;
}

function StepSquare({ status }: { status: PhaseStatus }) {
  const reached = status !== "Pending";
  return (
    <span
      className={cn(
        "flex size-[28px] shrink-0 items-center justify-center rounded-[2px]",
        reached ? "bg-primary text-white" : "bg-[#E5E5E5] text-[#F7F7F7]",
      )}
    >
      <Check className="size-[16px]" strokeWidth={2.5} aria-hidden />
    </span>
  );
}

function StepCaption({ phase }: { phase: ProjectPhase }) {
  if (phase.status === "InProgress") {
    return <p className="text-[12px] font-semibold leading-[15px] text-primary">In Progress</p>;
  }
  // Real dates when the phase has them; the display text otherwise (template ranges).
  const range: [string, string] | null =
    phase.startDate && phase.endDate ? [formatDay(phase.startDate), formatDay(phase.endDate)] : splitRange(phase.dateRange);
  if (!range) return <p className="text-[12px] leading-[15px] text-[#737373]">{phase.dateRange}</p>;
  return (
    <>
      <p className="text-[12px] leading-[15px] text-[#737373]"><span className="text-primary">From</span> {range[0]}</p>
      <p className="text-[12px] leading-[15px] text-[#737373]"><span className="text-primary">To</span> {range[1]}</p>
    </>
  );
}

function TimelineStep({ phase, prevPhase, isFirst }: { phase: ProjectPhase; prevPhase?: ProjectPhase; isFirst: boolean }) {
  // A segment is blue when the work on its left has been reached: the first
  // stub shows the phase it leads into, later ones the phase before them.
  const leftReached = isFirst ? phase.status !== "Pending" : prevPhase?.status === "Done";
  const rightReached = phase.status === "Done";

  return (
    <li className="flex w-[139px] shrink-0 flex-col items-center">
      <div className="flex w-full items-center">
        <div className={cn("h-[3px] flex-1", leftReached ? "bg-primary" : "bg-[#E5E5E5]")} />
        <StepSquare status={phase.status} />
        <div className={cn("h-[3px] flex-1", rightReached ? "bg-primary" : "bg-[#E5E5E5]")} />
      </div>
      <div className="mt-[7px] w-full px-[4px] text-center">
        <p className="text-[12px] font-semibold leading-[16px] text-[#1E1E1E]">{phase.name}</p>
        <StepCaption phase={phase} />
      </div>
    </li>
  );
}

export function TimelineStepper({ phases }: { phases: ProjectPhase[] }) {
  return (
    <div className="ml-[14px] overflow-x-auto no-scrollbar">
      <ol className="-ml-[17px] flex min-w-max flex-row">
        {phases.map((phase, idx) => (
          <TimelineStep key={phase.id} phase={phase} prevPhase={idx > 0 ? phases[idx - 1] : undefined} isFirst={idx === 0} />
        ))}
      </ol>
    </div>
  );
}

TimelineStepper.displayName = "TimelineStepper";

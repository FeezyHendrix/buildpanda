import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { cn } from "@/lib/utils";
import type { PhaseStatus, ProjectPhase } from "@/lib/project-types";

export function TimelineStepper({ phases }: { phases: ProjectPhase[] }) {
  return (
    <ol className="flex flex-row">
      {phases.map((phase, idx) => (
        <TimelineStep
          key={phase.id}
          phase={phase}
          prevPhase={idx > 0 ? phases[idx - 1] : undefined}
          isFirst={idx === 0}
        />
      ))}
    </ol>
  );
}

function TimelineStep({
  phase,
  prevPhase,
  isFirst,
}: {
  phase: ProjectPhase;
  prevPhase?: ProjectPhase;
  isFirst: boolean;
}) {
  // Each line segment is blue when the dot on its LEFT is Done.
  // For the first step's left stub, the "dot on the left" is the first dot itself.
  const leftDone  = isFirst ? phase.status === "Done" : prevPhase?.status === "Done";
  const rightDone = phase.status === "Done";

  return (
    <li className="flex flex-1 flex-col items-center">
      {/* [left-line][dot][right-line] — dot centred in its column */}
      <div className="flex w-full items-center">
        <div className={cn("h-1 flex-1", leftDone  ? "bg-primary" : "bg-[#EDEDED]")} />
        <StepDot status={phase.status} />
        <div className={cn("h-1 flex-1", rightDone ? "bg-primary" : "bg-[#EDEDED]")} />
      </div>

      {/* Labels centred below the dot */}
      <div className="mt-3 w-full px-1 text-center">
        <p className="text-[13px] font-semibold text-gray-900">{phase.name}</p>
        {phase.status === "InProgress" ? (
          <p className="mt-0.5 text-[11px] font-medium text-primary">In Progress</p>
        ) : (
          <p className="mt-0.5 text-[11px] text-gray-400">{phase.dateRange}</p>
        )}
      </div>
    </li>
  );
}

function StepDot({ status }: { status: PhaseStatus }) {
  if (status === "Done") {
    return (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#004DE7]">
        <ReactSVG
          src={icons.verifiedCheck}
          className="[&_circle]:fill-white [&_path]:fill-white [&_path]:stroke-white [&_svg]:size-4"
        />
      </div>
    );
  } else if (status === "InProgress") {
    return (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#004DE7]">
        <ReactSVG src={icons.verifyLine} />
      </div>
    )
  }
  // Pending
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F4F4F4]">
      <ReactSVG
        src={icons.pending}
        className="[&_path]:fill-[#C0C0C0] [&_circle]:fill-[#C0C0C0] [&_circle]:stroke-[#C0C0C0] [&_svg]:size-4"
      />
    </div>
  );
}

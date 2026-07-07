import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { cn } from "@/lib/utils";
import type { PhaseStatus, ProjectPhase } from "@/lib/project-types";

export function TimelineStepper({ phases }: { phases: ProjectPhase[] }) {
  return (
    <div className="overflow-x-auto pb-2 no-scrollbar">
      <ol className="flex min-w-max flex-row">
        {phases.map((phase, idx) => (
          <TimelineStep
            key={phase.id}
            phase={phase}
            prevPhase={idx > 0 ? phases[idx - 1] : undefined}
            isFirst={idx === 0}
          />
        ))}
      </ol>
    </div>
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
    <li className="flex basis-40 shrink-0 grow flex-col items-center">
      <div className="flex w-full items-center">
        <div className={cn("h-1 flex-1", leftDone  ? "bg-primary" : "bg-[#EDEDED]")} />
        <StepDot status={phase.status} />
        <div className={cn("h-1 flex-1", rightDone ? "bg-primary" : "bg-[#EDEDED]")} />
      </div>

      <div className="mt-3 w-full px-2 text-center">
        <p className="text-[13px] font-semibold text-gray-900">{phase.name}</p>
        {phase.status === "InProgress" ? (
          <p className="mt-1 text-[11px] font-medium text-primary">In Progress</p>
        ) : (
          <p className="mt-1 text-[11px] text-gray-400">{phase.dateRange}</p>
        )}
      </div>
    </li>
  );
}

function StepDot({ status }: { status: PhaseStatus }) {
  if (status === "Done") {
    return (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white">
        <ReactSVG
          src={icons.verifiedCheck}
          className="[&_svg]:size-10"
        />
      </div>
    );
  } else if (status === "InProgress") {
    return (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white">
        <ReactSVG 
        src={icons.verifyLine}
        className='[&_svg]:size-10' 
      />
      </div>
    )
  }
  // Pending
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white">
      <ReactSVG
        src={icons.verifiedCheck}
        className='[&_svg]:size-10 [&_path]:fill-black-100'
        // className="[&_path]:fill-[#C0C0C0] [&_circle]:fill-[#C0C0C0] [&_circle]:stroke-[#C0C0C0] [&_svg]:size-4"
      />
    </div>
  );
}

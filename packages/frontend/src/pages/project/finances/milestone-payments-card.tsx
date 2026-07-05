import { Link } from "react-router-dom";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { Card } from "@/components/atoms/card";
import { MilestoneCard } from "@/components/molecules/milestone-card";
import type { MilestonePayment, ProjectFinances as ProjectFinancesData } from "@/lib/project-types";
import { EmptyState } from "@/components";
import { div } from "three/src/nodes/TSL.js";

export interface MilestonePaymentsCardProps {
  projectId: string;
  milestones: MilestonePayment[];
  currency: ProjectFinancesData["currency"];
  onRequestRelease?: (milestone: MilestonePayment) => void;
  onRequestDispute?: (milestone: MilestonePayment) => void;
  className?: string;
}

export function MilestonePaymentsCard({
  projectId,
  milestones,
  currency,
  onRequestRelease,
  onRequestDispute,
  className,
}: MilestonePaymentsCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <ReactSVG src={icons.money} />
          <h3 className="text-[13px] font-semibold text-black-300">
            Milestone Payments
          </h3>
        </div>
        <Link
          to={`/project/${projectId}/finances/milestone-payments`}
          className="text-xs font-semibold text-[#004DE7] bg-white rounded-[100px] py-[4px] px-[16px]"
        >
          View More
        </Link>
      </div>

      <div className="bg-white rounded-[12px] h-full m-1 p-6">
        {milestones.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              title="No milestone payments yet"
              // icon={(<ReactSVG src={icons.riskShield} />)}
              description="No milestones have been added to this project."
              className="py-6"
            />
          </div>
        ) : (
          <div className="flex items-center gap-4 overflow-x-auto">
            {milestones.map((milestone, idx) => (
              <MilestoneCard
                key={`${milestone.id}-${idx}`}
                milestone={milestone}
                currency={currency}
                variant="compact"
                onReleaseFunds={onRequestRelease ? () => onRequestRelease(milestone) : undefined}
                onRaiseDispute={onRequestDispute ? () => onRequestDispute(milestone) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import { TourGuide } from "@/components/molecules/tour-guide";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectUpdates } from "@/hooks/use-updates";
import { useTour } from "@/hooks/use-tour";
import { CONSTRUCTION_TOUR_KEY, CONSTRUCTION_TOUR_STEPS } from "@/lib/tour-steps";
import {
  useCreateRiskFactor,
  useDeleteRiskFactor,
  useEditRiskFactor,
  useProjectRiskFactors,
} from "@/hooks/use-risks";
import { formatCurrency } from "@/lib/formatters";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { cn } from "@/lib/utils";

import { WhatsNextCard } from "@/components/organisms/whats-next-card";
import { WeatherDashboard } from "@/components/organisms/weather-dashboard";
import { useSession } from "@/stores/auth";
import { RecentUpdatesPanel } from "./overview/recent-updates-panel";
import { RiskFactorsPanel } from "./overview/risk-factors-panel";
import { TimelineStepper } from "./overview/timeline-stepper";
import { ProjectUpdate, RiskFactor } from "@/lib/project-types";
import { UpsertRiskDialog, UpsertRiskValues } from "@/components/molecules/upsert-risk-dialog";
import { useState } from "react";
import { ConfirmDialog, EmptyState, IconBox } from "@/components";
import { AlertIcon } from "@/components/atoms/project-nav-icons";


const RECENT_UPDATE_LIMIT = 2;

export default function ProjectOverview() {
  const { project } = useProjectContext();
  const { data: session } = useSession();
  const { data: updates = [] } = useProjectUpdates(project.id);
  const { data: risks = [] } = useProjectRiskFactors(project.id);

  const firstName = (session?.user?.name ?? "").trim().split(" ")[0] || "there";
  const recent = updates.slice(0, RECENT_UPDATE_LIMIT);

  const tour = useTour({
    tourKey: CONSTRUCTION_TOUR_KEY,
    steps: CONSTRUCTION_TOUR_STEPS,
    enabled: true,
  });

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Stay in control with real-time updates on progress, payments, and site activity."
        badges={
          <div className="flex items-center gap-2">
            <Badge size="md" className={cn('bg-[#F6F6F6] flex items-center gap-2 h-[21px]')}>
              <div className='flex items-center justify-center rounded-full bg-white h-[17px] w-[17px]'>
                <ReactSVG src={icons.love} />
            </div>
            <p className='text-[13px] font-semibold text-black-200'><span className='text-primary'>{project.healthScore}</span>/100</p>
            </Badge>
            <Badge size="md" className={cn('bg-[#F6F6F6] flex items-center gap-2 h-[21px]')}>
              <div className='flex items-center justify-center rounded-full bg-white h-[17px] w-[17px]'>
                <ReactSVG src={icons.shield} />
            </div>
              <p className='text-[13px] font-semibold text-black-200'>{project.risk}</p>
            </Badge>
          </div>
        }
      />

      {/* <div className="mt-6">
        <InsightsSummary projectId={project.id} />
      </div> */}

      <div className="mt-8">
        <WeatherDashboard projectId={project.id} />
      </div>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div data-tour="construction-progress">
          <KpiCard
            title="Construction Progress"
            icon={icons.constructionProgress}
            progress={project.progressPercent}
            className="rounded-tl-[16px] rounded-tr-[1px] rounded-br-[1px] rounded-bl-[16px]"
          />
        </div>
        <div data-tour="construction-budget">
          <KpiCard
            title="Budget Used"
            value={formatCurrency(project.budgetUsed, project.currency)}
            subValue={`of ${formatCurrency(project.budgetTotal, project.currency)}`}
            icon={icons.card}
          />
        </div>
        <div data-tour="construction-approvals">
          <KpiCard
            title="Pending Approvals"
            value={project.pendingApprovals}
            subValue={project.pendingApprovals > 0 ? "Awaiting your review" : "Nothing pending"}
            icon={icons.penSquare}
          />
        </div>
        <KpiCard
          title="Next Inspection"
          value={project.nextInspection.date || "None scheduled"}
          subValue={project.nextInspection.type || undefined}
          icon={icons.calendarSearch}
          className="rounded-tl-[1px] rounded-tr-[16px] rounded-br-[16px] rounded-bl-[1px]"
        />
      </section>

      <div className="mt-6">
        <WhatsNextCard projectId={project.id} />
      </div>

      <Card data-tour="construction-timeline" className="rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0 mt-6">
        <div className="flex items-center justify-between py-3 px-5">
          <div className="flex gap-2 items-center">
            <ReactSVG src={icons.hourglass} />
            <h3 className="text-[13px] font-semibold text-black-300">
              Project Timeline
            </h3>
          </div>
          <Link
            to={`/project/${project.id}/project-chart`}
            className="text-xs font-semibold text-[#004DE7] bg-white rounded-[100px] py-[4px] px-[16px]"
          >
            View Detailed Gantt
          </Link>
        </div>
        <div className="bg-white rounded-[12px] h-full m-1 overflow-x-auto">
          <div className="min-w-[480px] p-6">
            <TimelineStepper phases={project.timeline} />
          </div>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 pb-8 lg:grid-cols-2">
        <RecentUpdatesPanel
          updates={recent}
          projectId={project.id}
          className="rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0"
        />
        <RiskFactorsPanel projectId={project.id} risks={risks} className="rounded-[16px] bg-[#F8F8F8] flex flex-col h-full py-0 px-0 border-none" />
      </div>

      <TourGuide
        active={tour.active}
        step={tour.step}
        index={tour.index}
        total={tour.total}
        onNext={tour.next}
        onBack={tour.back}
        onSkip={tour.skip}
      />
    </div>
  );
}


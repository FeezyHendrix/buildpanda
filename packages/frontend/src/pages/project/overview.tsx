import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { KpiCard } from "@/components/molecules/kpi-card";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { PageHeader } from "@/components/molecules/page-header";
import { TourGuide } from "@/components/molecules/tour-guide";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectUpdates } from "@/hooks/use-updates";
import { useBuildings } from "@/hooks/use-buildings";
import { useFeatureFlagState } from "@/hooks/use-feature-flags";
import { useTour } from "@/hooks/use-tour";
import { CONSTRUCTION_TOUR_KEY, CONSTRUCTION_TOUR_STEPS } from "@/lib/tour-steps";
import { useAutoWindow } from "@/hooks/use-look-aheads";
import {
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
import { FeatureGate } from "@/components/atoms/feature-gate";

const RECENT_UPDATE_LIMIT = 2;

export default function ProjectOverview() {
  const { project } = useProjectContext();
  const { data: session } = useSession();
  const { data: updates = [] } = useProjectUpdates(project.id);
  const { data: risks = [] } = useProjectRiskFactors(project.id);
  const { data: autoWindow } = useAutoWindow(project.id, 4);
  const multiBuilding = useFeatureFlagState("projects.multiBuilding");
  const { data: buildings = [] } = useBuildings(
    project.id,
    multiBuilding.enabled && !multiBuilding.isLoading,
  );
  const realBuildings = buildings.filter((b) => b.kind === "real");

  const firstName = (session?.user?.name ?? "").trim().split(" ")[0] || "there";
  const recent = updates.slice(0, RECENT_UPDATE_LIMIT);
  const upcomingCount = autoWindow?.activities.length ?? 0;
  const uncoveredCount = autoWindow?.activities.filter((a) => !a.hasMaterialCoverage).length ?? 0;

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
          <div className="flex items-center gap-2 order-1 lg:order-2 self-end lg:self-auto">
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

      <FeatureGate flag="projects.weather">
        <div className="mt-8">
          <WeatherDashboard projectId={project.id} />
        </div>
      </FeatureGate>

      {realBuildings.length > 1 && (
        <section className="mt-8 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-900">Buildings</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {realBuildings.map((b) => (
              <Card key={b.id} className="p-4 flex flex-col gap-3 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/project/${project.id}/buildings/${b.id}/stages`}
                      className="text-base font-semibold text-gray-900 hover:text-[#004DE7]"
                    >
                      {b.name}
                    </Link>
                    {b.code && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                        {b.code}
                      </span>
                    )}
                  </div>
                  <Badge tone={b.status === "completed" ? "success" : b.status === "active" ? "info" : b.status === "on_hold" ? "warning" : "neutral"} size="sm">
                    {b.status === "completed" ? "Completed" : b.status === "active" ? "Active" : b.status === "on_hold" ? "On Hold" : "Planned"}
                  </Badge>
                </div>
                <div className="flex flex-col gap-1.5 mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Progress</span>
                    <span className="font-medium text-gray-900">{b.progressPercent}%</span>
                  </div>
                  <ProgressBar value={b.progressPercent} className="h-2" />
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

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
          title="Upcoming Look Aheads"
          value={upcomingCount > 0 ? upcomingCount : "None scheduled"}
          subValue={
            upcomingCount === 0
              ? undefined
              : uncoveredCount > 0
                ? `${uncoveredCount} without materials ordered`
                : "All materials ordered"
          }
          warn={uncoveredCount > 0}
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


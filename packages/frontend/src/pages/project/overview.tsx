import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { PageHeader } from "@/components/molecules/page-header";
import { TourGuide } from "@/components/molecules/tour-guide";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectUpdates } from "@/hooks/use-updates";
import { useBuildings } from "@/hooks/use-buildings";
import { useFeatureFlagState } from "@/hooks/use-feature-flags";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { useTour } from "@/hooks/use-tour";
import { CONSTRUCTION_TOUR_KEY, CONSTRUCTION_TOUR_STEPS } from "@/lib/tour-steps";
import { useProjectRiskFactors } from "@/hooks/use-risks";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { cn } from "@/lib/utils";

import { WhatsNextCard } from "@/components/organisms/whats-next-card";
import { WeatherDashboard } from "@/components/organisms/weather-dashboard";
import { CashFlowSCurve } from "@/components/organisms/charts/cash-flow-s-curve";
import { BudgetVsActualBar } from "@/components/organisms/charts/budget-vs-actual-bar";
import { useSession } from "@/stores/auth";
import { RecentUpdatesPanel } from "./overview/recent-updates-panel";
import { RiskFactorsPanel } from "./overview/risk-factors-panel";
import { OverviewKpis } from "./overview/overview-kpis";
import { NeedsAttentionCard } from "./overview/needs-attention-card";
import { ProgrammeCard } from "./overview/programme-card";
import { FieldActivityCard } from "./overview/field-activity-card";
import { FeatureGate } from "@/components/atoms/feature-gate";
import type { Building } from "@/api/buildings";

const RECENT_UPDATE_LIMIT = 2;
const PANEL_CLASS = "rounded-[16px] flex flex-col h-full py-0 px-0";
const EMPTY_CATEGORIES: never[] = [];
const EMPTY_POINTS: never[] = [];

const BUILDING_STATUS: Record<Building["status"], { tone: "success" | "info" | "warning" | "neutral"; label: string }> = {
  completed: { tone: "success", label: "Completed" },
  active: { tone: "info", label: "Active" },
  on_hold: { tone: "warning", label: "On Hold" },
  planned: { tone: "neutral", label: "Planned" },
};

function BuildingCard({ building, projectId }: { building: Building; projectId: string }) {
  const status = BUILDING_STATUS[building.status];
  return (
    <Card className="p-4 flex flex-col gap-3 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to={`/project/${projectId}/buildings/${building.id}/stages`}
            className="text-base font-semibold text-gray-900 hover:text-[#004DE7]"
          >
            {building.name}
          </Link>
          {building.code ? (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
              {building.code}
            </span>
          ) : null}
        </div>
        <Badge tone={status.tone} size="sm">
          {status.label}
        </Badge>
      </div>
      <div className="flex flex-col gap-1.5 mt-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Progress</span>
          <span className="font-medium text-gray-900">{building.progressPercent}%</span>
        </div>
        <ProgressBar value={building.progressPercent} className="h-2" />
      </div>
    </Card>
  );
}

export default function ProjectOverview() {
  const { project } = useProjectContext();
  const { data: session } = useSession();
  const { data: updates = [] } = useProjectUpdates(project.id);
  const { data: risks = [] } = useProjectRiskFactors(project.id);
  const snapshot = useReportingSnapshot(project.id);
  const multiBuilding = useFeatureFlagState("projects.multiBuilding");
  const { data: buildings = [] } = useBuildings(
    project.id,
    multiBuilding.enabled && !multiBuilding.isLoading,
  );
  const realBuildings = buildings.filter((b) => b.kind === "real");

  const firstName = (session?.user?.name ?? "").trim().split(" ")[0] || "there";
  const recent = updates.slice(0, RECENT_UPDATE_LIMIT);
  const finance = snapshot.data?.finance;

  const tour = useTour({
    tourKey: CONSTRUCTION_TOUR_KEY,
    steps: CONSTRUCTION_TOUR_STEPS,
    enabled: true,
  });

  return (
    <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
      <PageHeader
        title={`Welcome back, ${firstName}`}
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

      {realBuildings.length > 1 ? (
        <section className="mt-8 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-900">Buildings</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {realBuildings.map((b) => (
              <BuildingCard key={b.id} building={b} projectId={project.id} />
            ))}
          </div>
        </section>
      ) : null}

      <OverviewKpis project={project} />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CashFlowSCurve
            points={finance?.cashFlow.points ?? EMPTY_POINTS}
            programmeCurve={snapshot.data?.schedule.programmeCostCurve}
            currency={project.currency}
            isLoading={snapshot.isPending}
          />
        </div>
        <NeedsAttentionCard projectId={project.id} className={PANEL_CLASS} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BudgetVsActualBar
          categories={finance?.budget.categories ?? EMPTY_CATEGORIES}
          currency={project.currency}
          isLoading={snapshot.isPending}
        />
        <ProgrammeCard project={project} className={PANEL_CLASS} />
      </div>

      <FeatureGate flag="projects.weather">
        <div className="mt-6">
          <WeatherDashboard projectId={project.id} />
        </div>
      </FeatureGate>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FieldActivityCard projectId={project.id} className={PANEL_CLASS} />
        <WhatsNextCard projectId={project.id} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 pb-8 lg:grid-cols-2">
        <RecentUpdatesPanel updates={recent} projectId={project.id} className={PANEL_CLASS} />
        <div id="risk-factors" className="scroll-mt-24">
          <RiskFactorsPanel projectId={project.id} risks={risks} className={PANEL_CLASS} />
        </div>
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

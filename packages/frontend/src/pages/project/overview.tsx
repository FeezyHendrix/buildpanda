import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { PageHeader } from "@/components/molecules/page-header";
import { Tabs, type TabItem } from "@/components/molecules/tabs";
import { TourGuide } from "@/components/molecules/tour-guide";
import {
  UpsertActionItemDialog,
  type UpsertActionItemValues,
} from "@/components/molecules/upsert-action-item-dialog";
import { WeatherDashboard } from "@/components/organisms/weather-dashboard";
import { WhatsNextCard } from "@/components/organisms/whats-next-card";
import { useCreateActionItem } from "@/hooks/use-action-items";
import { useBuildings } from "@/hooks/use-buildings";
import { useFeatureFlagState } from "@/hooks/use-feature-flags";
import { useAutoWindow } from "@/hooks/use-look-aheads";
import { useParticipants } from "@/hooks/use-participants";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { useProjectRiskFactors } from "@/hooks/use-risks";
import { useTour } from "@/hooks/use-tour";
import { useProjectUpdates } from "@/hooks/use-updates";
import { useProjectContext } from "@/layouts/project-layout";
import { CONSTRUCTION_TOUR_KEY, CONSTRUCTION_TOUR_STEPS } from "@/lib/tour-steps";
import { ActivityPanel } from "./overview/activity-panel";
import { BuildingsPanel } from "./overview/buildings-panel";
import { OverviewKpis } from "./overview/overview-kpis";
import { OVERVIEW_TABS, useOverviewTab, type OverviewTab } from "./overview/overview-tabs";
import { RiskFactorsPanel } from "./overview/risk-factors-panel";

const RECENT_UPDATE_LIMIT = 5;

export default function ProjectOverview() {
  const { project } = useProjectContext();
  const navigate = useNavigate();
  const { data: updates = [] } = useProjectUpdates(project.id);
  const { data: risks = [] } = useProjectRiskFactors(project.id);
  const { data: autoWindow } = useAutoWindow(project.id, 4);
  const { data: snapshot } = useReportingSnapshot(project.id);
  const { data: participants = [] } = useParticipants(project.id);
  const createItem = useCreateActionItem();

  const weatherFlag = useFeatureFlagState("projects.weather");
  const multiBuilding = useFeatureFlagState("projects.multiBuilding");
  const { data: buildings = [] } = useBuildings(project.id, multiBuilding.enabled && !multiBuilding.isLoading);
  const realBuildings = buildings.filter((b) => b.kind === "real");

  const visibleTabs: readonly TabItem<OverviewTab>[] = OVERVIEW_TABS.filter((t) => {
    if (t.id === "weather") return weatherFlag.enabled;
    if (t.id === "buildings") return realBuildings.length > 1;
    return true;
  });
  const { tab, setTab } = useOverviewTab(visibleTabs);

  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [createRiskOpen, setCreateRiskOpen] = useState(false);

  const assigneeOptions = participants
    .filter((p) => p.userId)
    .map((p) => ({ id: p.userId as string, name: p.name ?? p.email }));

  function handleCreateItem(values: UpsertActionItemValues): void {
    createItem.mutate({ projectId: project.id, ...values }, { onSuccess: () => setCreateItemOpen(false) });
  }

  const tour = useTour({ tourKey: CONSTRUCTION_TOUR_KEY, steps: CONSTRUCTION_TOUR_STEPS, enabled: true });

  const tabActions: Record<OverviewTab, ReactNode> = {
    activity: (
      <>
        <Button variant="ghost" size="md" onClick={() => navigate(`/project/${project.id}/updates`)}>
          All updates
        </Button>
        <Button variant="ghost" size="md" onClick={() => navigate(`/project/${project.id}/project-chart`)}>
          Detailed Gantt
        </Button>
      </>
    ),
    risks: (
      <Button variant="ghost" size="md" onClick={() => setCreateRiskOpen(true)}>
        Add risk
      </Button>
    ),
    weather: null,
    actions: (
      <Button variant="ghost" size="md" onClick={() => navigate(`/project/${project.id}/whats-next`)}>
        All recommendations
      </Button>
    ),
    buildings: null,
  };

  return (
    <div className="flex w-full flex-col gap-4 px-4 pt-4 pb-8 sm:px-10 lg:px-6">
      <PageHeader
        title="Overview"
        actions={
          <Button variant="ghost" size="md" onClick={() => setCreateItemOpen(true)}>
            Add action item
          </Button>
        }
      />

      <OverviewKpis project={project} risks={risks} autoWindow={autoWindow} snapshot={snapshot} />

      <Tabs
        items={visibleTabs}
        value={tab}
        onChange={setTab}
        actions={tabActions[tab]}
        ariaLabel="Project insights"
      />

      <OverviewTabPanel tab={tab}>
        {tab === "activity" ? (
          <ActivityPanel
            projectId={project.id}
            updates={updates.slice(0, RECENT_UPDATE_LIMIT)}
            phases={project.timeline}
          />
        ) : tab === "risks" ? (
          <RiskFactorsPanel
            projectId={project.id}
            risks={risks}
            createOpen={createRiskOpen}
            onCreateOpenChange={setCreateRiskOpen}
          />
        ) : tab === "weather" ? (
          <WeatherDashboard projectId={project.id} />
        ) : tab === "actions" ? (
          <WhatsNextCard projectId={project.id} />
        ) : (
          <BuildingsPanel projectId={project.id} buildings={realBuildings} />
        )}
      </OverviewTabPanel>

      <UpsertActionItemDialog
        open={createItemOpen}
        onOpenChange={setCreateItemOpen}
        mode="create"
        assigneeOptions={assigneeOptions}
        onSubmit={handleCreateItem}
        isSubmitting={createItem.isPending}
        error={(createItem.error as Error | undefined)?.message ?? null}
      />

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

/**
 * Tables bleed to the page gutter (their 24px outer-cell padding becomes the
 * gutter), so the panel pulls the tab rule's 16px gap back to zero for them.
 */
function OverviewTabPanel({ tab, children }: { tab: OverviewTab; children: ReactNode }) {
  const bleeds = tab !== "weather";
  return (
    <div role="tabpanel" className={bleeds ? "-mt-4" : undefined}>
      {children}
    </div>
  );
}

OverviewTabPanel.displayName = "OverviewTabPanel";

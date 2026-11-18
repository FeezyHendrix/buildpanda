import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import type { BuildingPhase } from "@/api/building-phases";
import { Button } from "@/components/atoms/button";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { Spinner } from "@/components/atoms/spinner";
import { TextInput } from "@/components/atoms/text-input";
import { MetricCard } from "@/components/molecules/metric-card";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { useBuildingPhases, useUpdateBuildingPhase } from "@/hooks/use-building-phases";
import {
  useCreateStage,
  useDeleteStage,
  useReorderStages,
  useStages,
  useUpdateStage,
} from "@/hooks/use-stages";
import { useProjectContext } from "@/layouts/project-layout";
import { errorMessage } from "@/lib/api-error";
import type { Stage } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { BuildStageRow } from "./stages/build-stage-row";
import { PhaseSection } from "./stages/phase-section";
import { StageDrawer } from "./stages/stage-drawer";

type BuildStageFilter = "all" | "completed" | "in-progress" | "not-started";

const FILTER_TABS: { key: BuildStageFilter; label: string }[] = [
  { key: "all", label: "All Stages" },
  { key: "completed", label: "Completed" },
  { key: "in-progress", label: "In Progress" },
  { key: "not-started", label: "Not Started" },
];

const FILTER_STATUS = { completed: "Done", "in-progress": "InProgress", "not-started": "Pending" } as const;

// Stages created before phases existed, or by an import, sit outside every phase.
const UNASSIGNED = "unassigned";

interface PhaseGroup {
  key: string;
  phase: BuildingPhase | null;
  /** After search and filter. */
  stages: Stage[];
  /** Before search and filter. */
  total: number;
}

function groupByPhase(phases: BuildingPhase[], stages: Stage[], visible: Stage[]): PhaseGroup[] {
  const known = new Set(phases.map((phase) => phase.id));
  const inPhase = (stage: Stage, phaseId: string | null) =>
    phaseId ? stage.buildingPhaseId === phaseId : !stage.buildingPhaseId || !known.has(stage.buildingPhaseId);
  const group = (key: string, phase: BuildingPhase | null): PhaseGroup => ({
    key,
    phase,
    stages: visible.filter((stage) => inPhase(stage, phase?.id ?? null)),
    total: stages.filter((stage) => inPhase(stage, phase?.id ?? null)).length,
  });
  const groups = phases.map((phase) => group(phase.id, phase));
  const unassigned = group(UNASSIGNED, null);
  return unassigned.total > 0 ? [...groups, unassigned] : groups;
}

export default function ProjectStages() {
  useSetPageTitle(
    "Build Stages",
    "Break the build into stages and track progress all the way to handover.",
  );

  const { project, access } = useProjectContext();
  // The exact action the stage and building-phase routes enforce; unknown access denies.
  const canManage = access?.permissions?.stages?.includes("manage") === true;
  const { buildingId } = useParams<{ buildingId?: string }>();
  const { data: stages = [] } = useStages(project.id, buildingId);
  const { data: phases = [], isLoading: phasesLoading } = useBuildingPhases(project.id, buildingId);
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();
  const reorderStages = useReorderStages();
  const renamePhase = useUpdateBuildingPhase(project.id);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BuildStageFilter>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The stage being edited; null while adding. Kept on close so the drawer does not change under the user.
  const [editing, setEditing] = useState<Stage | null>(null);
  // Until the user toggles one, the first phase is open.
  const [expanded, setExpanded] = useState<Set<string> | null>(null);

  const complete = stages.filter((s) => s.status === "Done").length;
  const inProgress = stages.filter((s) => s.status === "InProgress").length;
  const overall =
    stages.length === 0
      ? 0
      : Math.round(
          stages.reduce((sum, s) => sum + s.progressPercent, 0) / stages.length,
        );

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visible = stages.filter(
      (s) =>
        (filter === "all" || s.status === FILTER_STATUS[filter]) &&
        (!q || s.name.toLowerCase().includes(q)),
    );
    return groupByPhase(phases, stages, visible);
  }, [phases, stages, filter, search]);

  const open = expanded ?? new Set(groups[0] ? [groups[0].key] : []);

  function toggle(key: string) {
    const next = new Set(open);
    if (!next.delete(key)) next.add(key);
    setExpanded(next);
  }

  function moveStage(draggedId: string, target: Stage): void {
    const phaseId = target.buildingPhaseId;
    if (!canManage || !phaseId) return;
    // From the unfiltered list, so a search never drops hidden stages from the phase order.
    const ids = stages.filter((s) => s.buildingPhaseId === phaseId).map((s) => s.id);
    const to = ids.indexOf(target.id);
    const from = ids.indexOf(draggedId);
    if (from >= 0) ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    reorderStages.mutate(
      { projectId: project.id, stageIds: ids, buildingPhaseId: phaseId },
      { onError: (error) => toast(errorMessage(error, "Could not move the stage")) },
    );
  }

  function openDrawer(stage: Stage | null) {
    (stage ? updateStage : createStage).reset();
    setEditing(stage);
    setDrawerOpen(true);
  }

  const saving = editing ? updateStage : createStage;

  return (
    <div className="w-full px-4 lg:px-8 py-6">
      {canManage ? (
        <div className="mb-6 flex justify-end">
          <Button
            variant="primary"
            size="lg"
            onClick={() => openDrawer(null)}
            className="gap-1.5"
          >
            <PlusIcon className="size-6" />
            Add Stage
          </Button>
        </div>
      ) : null}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Construction Progress"
          value={`${overall}%`}
          trend={{ label: "10% vs Last month" }}
        />
        <MetricCard
          label="Total Stages"
          value={stages.length}
          helperText="Across all phases"
        />
        <MetricCard
          label="In Progress"
          value={inProgress}
          helperText="Active stages"
        />
        <MetricCard
          label="Completed"
          value={complete}
          helperText="Finished stages"
        />
      </div>

      {/* Search + filters */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-[360px]">
          <ReactSVG
            src={icons2.search}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 shrink-0 [&_svg]:size-[18px]"
          />
          <TextInput
            type="search"
            placeholder="Search stages"
            value={search}
            onChange={setSearch}
            aria-label="Search stages"
            className="h-10 w-full indent-8"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={cn(
                "whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
                filter === tab.key
                  ? "border-[#111827] bg-[#111827] text-white"
                  : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Phases */}
      {/* Access still loading: wait, so stages are not briefly shown outside their phases. */}
      {phasesLoading || !access ? (
        <div className="mt-6 flex justify-center py-10">
          <Spinner size="md" />
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-6 border border-dashed border-[#E5E7EB] bg-white px-4 py-10 text-center text-sm text-[#9CA3AF]">
          {canManage
            ? "No building phases yet. Add a stage to create the first phase."
            : "No building phases yet."}
        </div>
      ) : (
        <div className="mt-6 flex flex-col border-[0.5px] border-border bg-white">
          {groups.map((group) => (
            <PhaseSection
              key={group.key}
              name={group.phase?.name ?? "Unassigned"}
              stageCount={group.phase?.stageCount ?? group.total}
              summary={group.phase}
              isOpen={open.has(group.key)}
              onToggle={() => toggle(group.key)}
              onRename={
                canManage && group.phase
                  ? (name) =>
                      renamePhase.mutate(
                        { phaseId: group.key, name },
                        { onError: (error) => toast(errorMessage(error, "Could not rename the phase")) },
                      )
                  : undefined
              }
              emptyText={
                group.stages.length > 0
                  ? null
                  : group.total === 0
                    ? "No stages in this phase yet."
                    : "No stages match your search or filter."
              }
            >
              {group.stages.map((stage) => (
                <BuildStageRow
                  key={stage.id}
                  stage={stage}
                  canManage={canManage}
                  onMove={moveStage}
                  onRename={(name) =>
                    updateStage.mutate({ projectId: project.id, stageId: stage.id, name })
                  }
                  onEdit={() => openDrawer(stage)}
                  onDelete={() =>
                    deleteStage.mutate(
                      { projectId: project.id, stageId: stage.id },
                      { onError: (error) => toast(errorMessage(error, "Could not delete the stage")) },
                    )
                  }
                />
              ))}
            </PhaseSection>
          ))}
        </div>
      )}

      {canManage ? (
        <StageDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          projectId={project.id}
          buildingId={buildingId}
          stage={editing}
          phases={phases}
          onSubmit={(values) => {
            const done = { onSuccess: () => setDrawerOpen(false) };
            if (editing) {
              updateStage.mutate({ projectId: project.id, stageId: editing.id, ...values }, done);
            } else {
              createStage.mutate({ projectId: project.id, buildingId, ...values }, done);
            }
          }}
          isSubmitting={saving.isPending}
          error={saving.error ? errorMessage(saving.error) : null}
        />
      ) : null}
    </div>
  );
}

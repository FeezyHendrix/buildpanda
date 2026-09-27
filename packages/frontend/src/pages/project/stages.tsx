import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { useProjectContext } from "@/layouts/project-layout";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { useParams } from "react-router-dom";
import {
  useCreateStage,
  useDeleteStage,
  useReorderStages,
  useStages,
  useUpdateStage,
} from "@/hooks/use-stages";
import { cn } from "@/lib/utils";
import {
  canResourceAction,
  type Stage,
  type StageStatus,
} from "@/lib/project-types";
import { TextInput } from "@/components/atoms/text-input";
import { Select } from "@/components/atoms/select";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { MetricCard } from "@/components/molecules/metric-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu";
import { ProgressBar } from "@/components";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";

// -- helpers --
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: StageStatus }) {
  if (status === "InProgress")
    return (
      <Badge tone="info" size="md">
        In progress
      </Badge>
    );
  if (status === "Done")
    return (
      <Badge tone="success" size="md">
        Completed
      </Badge>
    );
  return (
    <Badge tone="neutral" variant="outline" size="md">
      Not Started
    </Badge>
  );
}

function PhaseStatusBadge({
  status,
}: {
  status: "Completed" | "In Progress" | "Not started";
}) {
  if (status === "Completed")
    return (
      <Badge tone="success" size="md">
        Completed
      </Badge>
    );
  if (status === "In Progress")
    return (
      <Badge tone="info" size="md">
        In progress
      </Badge>
    );
  return (
    <Badge tone="neutral" variant="outline" size="md">
      Not Started
    </Badge>
  );
}

// Mock phases until backend lands (see docs/build-stages-phases-backend.md)
const PHASE_ORDER = [
  "Pre-Construction",
  "Sub-structure",
  "Services",
  "MEP",
  "Finishes",
] as const;

type BuildStageFilter = "all" | "completed" | "in-progress" | "not-started";

const FILTER_TABS: { key: BuildStageFilter; label: string }[] = [
  { key: "all", label: "All Stages" },
  { key: "completed", label: "Completed" },
  { key: "in-progress", label: "In Progress" },
  { key: "not-started", label: "Not Started" },
];

export default function ProjectStages() {
  useSetPageTitle(
    "Build Stages",
    "Break the build into stages and track progress all the way to handover.",
  );

  const { project, access } = useProjectContext();
  const canManage = Boolean(
    access && canResourceAction(access, "schedule", "manage"),
  );
  const { buildingId } = useParams<{ buildingId?: string }>();
  const { data: stages = [] } = useStages(project.id, buildingId);
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();
  const reorderStages = useReorderStages();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BuildStageFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [inlineEditPhase, setInlineEditPhase] = useState<string | null>(null);
  const [inlinePhaseValue, setInlinePhaseValue] = useState("");

  // Phases state (frontend mock until backend)
  const [phases, setPhases] = useState<string[]>([...PHASE_ORDER]);

  const complete = stages.filter((s) => s.status === "Done").length;
  const inProgress = stages.filter((s) => s.status === "InProgress").length;
  const overall =
    stages.length === 0
      ? 0
      : Math.round(
          stages.reduce((sum, s) => sum + s.progressPercent, 0) / stages.length,
        );

  // Search + filter
  const filtered = useMemo(() => {
    let out = stages;
    if (filter === "completed") out = out.filter((s) => s.status === "Done");
    else if (filter === "in-progress")
      out = out.filter((s) => s.status === "InProgress");
    else if (filter === "not-started")
      out = out.filter((s) => s.status === "Pending");
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((s) => s.name.toLowerCase().includes(q));
    }
    return out;
  }, [stages, filter, search]);

  // Stable stage → phase assignment, keyed by stage id. Round-robin (demo
  // only; replace with real building_phase_id grouping once the API lands —
  // see docs/build-stages-phases-backend.md). This is a persistent map, not a
  // memo recomputed from the current `stages` order: a stage's phase is
  // decided ONCE, the first time its id is seen (in original array-position
  // order), and never revisited afterwards. Deriving the round-robin index
  // from the live `stages` array position (as earlier versions did) breaks
  // two ways: searching/filtering shrinks the array and reindexes every
  // match, and — the bug reported here — reordering via drag-and-drop
  // (`reorderStages.mutate`) refetches `stages` in a new order, which
  // reindexes and reshuffles EVERY stage's phase, not just the one dragged.
  const phaseAssignment = useRef(new Map<string, string>());
  const phaseAssignCounter = useRef(0);

  const phaseByStageId = useMemo(() => {
    const map = phaseAssignment.current;
    stages.forEach((s) => {
      if (map.has(s.id) || phases.length === 0) return;
      map.set(s.id, phases[phaseAssignCounter.current % phases.length]!);
      phaseAssignCounter.current += 1;
    });
    return map;
  }, [stages, phases]);

  // Group stages into phases using the stable assignment above.
  const grouped = useMemo(() => {
    const map = new Map<string, Stage[]>();
    phases.forEach((p) => map.set(p, []));
    filtered.forEach((s) => {
      const phase = phaseByStageId.get(s.id) ?? phases[0];
      if (phase) map.get(phase)?.push(s);
    });
    // If no stages, keep phases empty (show 0 stages rows like Figma)
    return phases.map((name) => {
      const list = map.get(name) ?? [];
      const progress =
        list.length === 0
          ? 0
          : Math.round(
              list.reduce((sum, s) => sum + s.progressPercent, 0) / list.length,
            );
      let status: "Completed" | "In Progress" | "Not started" = "Not started";
      if (list.length > 0 && list.every((s) => s.status === "Done"))
        status = "Completed";
      else if (
        list.some((s) => s.status === "InProgress" || s.status === "Done")
      )
        status = "In Progress";
      return { name, stages: list, progress, status, count: list.length };
    });
  }, [phases, filtered, phaseByStageId]);

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(PHASE_ORDER[0] ? [PHASE_ORDER[0]] : []),
  );

  function togglePhase(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleCreatePhase(name: string) {
    if (!name.trim()) return;
    setPhases((prev) => [...prev, name.trim()]);
  }

  function startInlinePhaseEdit(name: string) {
    setInlineEditPhase(name);
    setInlinePhaseValue(name);
  }

  function commitInlinePhaseEdit(oldName: string) {
    const v = inlinePhaseValue.trim();
    if (!v || v === oldName) {
      setInlineEditPhase(null);
      return;
    }
    setPhases((prev) => prev.map((p) => (p === oldName ? v : p)));
    // Carry over every stage already assigned to `oldName` in the sticky
    // phaseAssignment map — otherwise they'd point at a phase name that no
    // longer exists in `phases` and silently vanish from every group.
    phaseAssignment.current.forEach((phaseName, stageId) => {
      if (phaseName === oldName) phaseAssignment.current.set(stageId, v);
    });
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(oldName)) {
        next.delete(oldName);
        next.add(v);
      }
      return next;
    });
    setInlineEditPhase(null);
  }

  function move(index: number, dir: -1 | 1): void {
    const target = index + dir;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    const cur = next[index];
    const swap = next[target];
    if (!cur || !swap) return;
    next[index] = swap;
    next[target] = cur;
    reorderStages.mutate({
      projectId: project.id,
      stageIds: next.map((s) => s.id),
    });
  }

  return (
    <div className="w-full px-4 lg:px-8 py-6">
      {/* Header with Add Stage at top */}
      {canManage && (
        <div className="mb-6 flex justify-end">
          <Button
            variant="primary"
            size="lg"
            onClick={() => setCreateOpen(true)}
            className="gap-1.5"
          >
            <PlusIcon className="size-6" />
            Add Stage
          </Button>
        </div>
      )}

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
      <div className="mt-6 flex flex-col border-[0.5px] border-border bg-white">
        {grouped.map((phase) => {
          const isOpen = expanded.has(phase.name);
          const isInlineEditing = inlineEditPhase === phase.name;
          return (
            <div
              key={phase.name}
              className="border-b-[0.5px] border-border last:border-b-0"
            >
              {/* Phase header — mirrors table colgroup: w-8 | 18%×5 | w-8 */}
              {isInlineEditing ? (
                // Editing collapses the row to just the name input — count,
                // status, progress and the edit action hide until committed
                // (Enter/blur) or cancelled (Escape), matching the Figma.
                <div className="flex min-w-0 items-center py-3 pl-4 pr-2">
                  <div className="w-8 shrink-0" aria-hidden />
                  <input
                    autoFocus
                    value={inlinePhaseValue}
                    onChange={(e) => setInlinePhaseValue(e.target.value)}
                    onBlur={() => commitInlinePhaseEdit(phase.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        commitInlinePhaseEdit(phase.name);
                      if (e.key === "Escape") setInlineEditPhase(null);
                    }}
                    aria-label={`Rename ${phase.name}`}
                    className="h-9 w-[280px] max-w-full border border-[#EBEBEB] bg-white px-3 text-sm font-semibold text-[#111827] outline-none focus:border-[#111827]"
                  />
                </div>
              ) : (
                <div className="flex min-w-0 items-center py-3 pl-4 pr-2">
                  {/* col 1: chevron (w-8) */}
                  <button
                    type="button"
                    onClick={() => togglePhase(phase.name)}
                    className="flex w-8 shrink-0 items-center justify-center text-[#6B7280] hover:text-[#111827]"
                    aria-label={isOpen ? "Collapse" : "Expand"}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn(
                        "transition-transform",
                        isOpen && "rotate-180",
                      )}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {/* col 2: name (18%) */}
                  <div className="w-[18%] min-w-0 pr-3">
                    <span className="block truncate text-sm font-semibold text-[#111827]">
                      {phase.name}
                    </span>
                  </div>

                  {/* col 3: stages count (18%) */}
                  <div className="w-[18%] pr-3">
                    <span className="text-xs text-[#9CA3AF]">
                      {phase.count} stages
                    </span>
                  </div>

                  {/* col 4: status (18%) */}
                  <div className="w-[18%] pr-3">
                    <PhaseStatusBadge status={phase.status} />
                  </div>

                  {/* cols 5+6: progress fills remaining space */}
                  <div className="flex flex-1 items-center gap-1 pr-3">
                    <ProgressBar
                      value={phase.progress}
                      className="h-[7px] flex-1"
                    />
                    <span className="w-9 shrink-0 text-right text-xs font-medium text-[#111827] tabular-nums">
                      {phase.progress}%
                    </span>
                  </div>

                  {/* col 7: edit action — pinned to right edge */}
                  <button
                    type="button"
                    onClick={() => startInlinePhaseEdit(phase.name)}
                    className="flex w-8 shrink-0 items-center justify-center text-[#9CA3AF] hover:text-[#111827]"
                    aria-label={`Edit ${phase.name}`}
                  >
                    <ReactSVG src={icons2.editTwo} className="[&_svg]:size-4" />
                  </button>
                </div>
              )}

              {/* Stage table */}
              {isOpen && (
                <div
                  className={`border-t-[0.5px] border-border bg-[#FAFAFA] px-4 py-4 ${!isOpen && "!border-t-0"}`}
                >
                  {phase.stages.length === 0 ? (
                    <div className="border border-dashed border-[#E5E7EB] bg-white px-4 py-6 text-center text-sm text-[#9CA3AF]">
                      No stages in this phase yet.
                    </div>
                  ) : (
                    <div className="overflow-hidden bg-white">
                      <table className="w-full min-w-[680px] table-fixed text-left border-[0.5px] border-border">
                        <colgroup>
                          <col className="w-8" />
                          <col className="w-[18%]" />
                          <col className="w-[18%]" />
                          <col className="w-[18%]" />
                          <col className="w-[18%]" />
                          <col className="w-[18%]" />
                          <col className="w-8" />
                        </colgroup>
                        <thead className="bg-gray-50">
                          <tr className="border-b-[0.5px] border-border text-caption-m text-[#606060] font-semibold">
                            <th className="px-2 py-3" />
                            <th className="px-3 py-3 text-caption-l font-semibold text-[#606060]">
                              Build Stages
                            </th>
                            <th className="px-3 py-3 text-caption-l font-semibold text-[#606060]">
                              Status
                            </th>
                            <th className="px-3 py-3 text-caption-l font-semibold text-[#606060]">
                              Start date
                            </th>
                            <th className="px-3 py-3 text-caption-l font-semibold text-[#606060]">
                              End date
                            </th>
                            <th className="px-3 py-3 text-caption-l font-semibold text-[#606060]">
                              Progress
                            </th>
                            <th className="px-2 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y-[0.5px] divide-border bg-white">
                          {phase.stages.map((stage) => {
                            const originalIndex = stages.indexOf(stage);
                            return (
                              <StageRow
                                key={stage.id}
                                stage={stage}
                                index={originalIndex}
                                total={stages.length}
                                canManage={canManage}
                                onMove={move}
                                onUpdate={(values) =>
                                  updateStage.mutate({
                                    projectId: project.id,
                                    stageId: stage.id,
                                    ...values,
                                  })
                                }
                                onDelete={() =>
                                  deleteStage.mutate({
                                    projectId: project.id,
                                    stageId: stage.id,
                                  })
                                }
                              />
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Stage Drawer - handles Add Building Phase inline via Go Back */}
      <AddStageDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        phases={phases}
        onCreatePhase={handleCreatePhase}
        onSubmit={(values) => {
          createStage.mutate(
            { projectId: project.id, buildingId, ...values },
            { onSuccess: () => setCreateOpen(false) },
          );
        }}
        isSubmitting={createStage.isPending}
        error={(createStage.error as Error | undefined)?.message ?? null}
      />

      {/* Inline edit for Build Stage is handled inside StageRow via UpsertStageDialog */}
    </div>
  );
}

function AddStageDrawer({
  open,
  onOpenChange,
  phases,
  onCreatePhase,
  onSubmit,
  isSubmitting,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phases: string[];
  onCreatePhase: (name: string) => void;
  onSubmit: (values: {
    name: string;
    status: StageStatus;
    startDate: string | null;
    endDate: string | null;
    progressPercent: number;
  }) => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  const [view, setView] = useState<"form" | "addPhase">("form");
  const [phase, setPhase] = useState<string>("");
  const [stageName, setStageName] = useState("");
  const [status, setStatus] = useState<StageStatus>("Pending");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [newPhaseName, setNewPhaseName] = useState("");

  useEffect(() => {
    if (open) {
      setView("form");
      setPhase("");
      setStageName("");
      setStatus("Pending");
      setStartDate("");
      setEndDate("");
      setNewPhaseName("");
    }
  }, [open]);

  const isValid = stageName.trim().length > 0;

  function handleCreatePhase() {
    const name = newPhaseName.trim();
    if (!name) return;
    onCreatePhase(name);
    setPhase(name);
    setNewPhaseName("");
    setView("form");
  }

  if (view === "addPhase") {
    return (
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Add Building Phase"
        description=""
        submitLabel="Save"
        submitDisabled={!newPhaseName.trim()}
        onSubmit={handleCreatePhase}
        footerVariant="stacked"
      >
        <button
          type="button"
          onClick={() => setView("form")}
          className="flex items-center gap-1 self-start text-sm font-medium text-[#111827] hover:underline"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Go Back
        </button>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[#1E1E1E]">
            Building Stage
          </label>
          <TextInput
            value={newPhaseName}
            onChange={setNewPhaseName}
            placeholder="Placeholder"
            autoFocus
          />
        </div>
      </FormDrawer>
    );
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Add New Stage"
      description="Create a new project stage to organize tasks, milestones, and progress. You can update or reorder stages later."
      submitLabel="Create New Stage"
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error}
      onSubmit={() =>
        onSubmit({
          name: stageName.trim(),
          status,
          startDate: startDate || null,
          endDate: endDate || null,
          progressPercent:
            status === "Done" ? 100 : status === "InProgress" ? 50 : 0,
        })
      }
      footerVariant="stacked"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-medium text-[#1E1E1E]">
            Building Phase
          </label>
          <button
            type="button"
            onClick={() => setView("addPhase")}
            className="text-xs font-medium text-[#004DE7] hover:underline"
          >
            + Add Building Phase
          </button>
        </div>
        <Select
          options={phases.map((p) => ({ value: p, label: p }))}
          value={phase || null}
          onChange={(v) => setPhase(v ?? "")}
          placeholder="Select Phase"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[#1E1E1E]">
          Building Stage
        </label>
        <TextInput
          value={stageName}
          onChange={setStageName}
          placeholder="Placeholder"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[#1E1E1E]">Status</label>
        <Select
          options={[
            { value: "Pending", label: "Not started" },
            { value: "InProgress", label: "In progress" },
            { value: "Done", label: "Completed" },
          ]}
          value={status}
          onChange={(v) => v && setStatus(v as StageStatus)}
          placeholder="Select Status"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[#1E1E1E]">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="DD/MM/YYYY"
            className="h-11 w-full border border-[#EBEBEB] bg-white px-3.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[#1E1E1E]">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="DD/MM/YYYY"
            className="h-11 w-full border border-[#EBEBEB] bg-white px-3.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10"
          />
        </div>
      </div>
    </FormDrawer>
  );
}

function StageRow({
  stage,
  index,
  total,
  canManage,
  onMove,
  onUpdate,
  onDelete,
}: {
  stage: Stage;
  index: number;
  total: number;
  canManage: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
  onUpdate: (values: any) => void;
  onDelete: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inlineEditing, setInlineEditing] = useState(false);
  const [inlineValue, setInlineValue] = useState(stage.name);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setInlineValue(stage.name);
  }, [stage.name]);

  function commitInline() {
    const v = inlineValue.trim();
    if (!v || v === stage.name) {
      setInlineEditing(false);
      setInlineValue(stage.name);
      return;
    }
    onUpdate({
      name: v,
      status: stage.status,
      startDate: stage.startDate,
      endDate: stage.endDate,
      progressPercent: stage.progressPercent,
    });
    setInlineEditing(false);
  }

  // Same handle icon/position as the Figma — dragging it swaps this row with
  // its immediate neighbor in the drop direction, one step per drop. onMove
  // only supports a single adjacent swap (see `move` in the parent), so we
  // deliberately don't try to walk a multi-position reorder here: calling it
  // repeatedly in one synchronous drop handler would all read the same stale
  // `stages` snapshot and produce a wrong order.
  function handleDragStart(e: React.DragEvent<HTMLTableRowElement>): void {
    if (!canManage) return;
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent<HTMLTableRowElement>): void {
    if (!canManage) return;
    e.preventDefault();
    setDragOver(true);
  }

  function handleDrop(e: React.DragEvent<HTMLTableRowElement>): void {
    e.preventDefault();
    setDragOver(false);
    if (!canManage) return;
    const fromIndex = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(fromIndex) || fromIndex === index) return;
    onMove(fromIndex, fromIndex < index ? 1 : -1);
  }

  return (
    <>
      <tr
        className={cn("group hover:bg-[#FAFAFA]", dragOver && "bg-[#EEF3FF]")}
        draggable={canManage}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <td className="px-2 py-3">
          <button
            type="button"
            aria-label="Drag handle"
            disabled={!canManage || total <= 1}
            title={canManage && total > 1 ? "Drag to reorder" : undefined}
            className={cn(
              "flex size-6 items-center justify-center text-[#9CA3AF]",
              canManage && total > 1
                ? "cursor-grab hover:text-[#111827] active:cursor-grabbing"
                : "cursor-default opacity-40",
            )}
          >
            <ReactSVG src={icons2.reorder} />
          </button>
        </td>
        <td className="px-3 py-3">
          {inlineEditing ? (
            <input
              autoFocus
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              onBlur={commitInline}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitInline();
                if (e.key === "Escape") {
                  setInlineEditing(false);
                  setInlineValue(stage.name);
                }
              }}
              className="h-8 w-full border border-[#EBEBEB] bg-white px-2 text-sm text-[#111827] outline-none focus:border-[#111827]"
            />
          ) : (
            <span className="text-sm font-medium text-[#111827]">
              {stage.name}
            </span>
          )}
        </td>
        <td className="px-3 py-3">
          <StatusBadge status={stage.status} />
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-sm text-[#6B7280]">
          {formatDate(stage.startDate)}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-sm text-[#6B7280]">
          {formatDate(stage.endDate)}
        </td>
        <td className="px-3 py-3">
          <span className="text-sm font-medium text-[#111827]">
            {stage.progressPercent}%
          </span>
        </td>
        <td className="px-2 py-3">
          {canManage && (
            <StageRowMenu
              onEdit={() => setEditOpen(true)}
              onInlineEdit={() => setInlineEditing(true)}
              onDelete={() => setDeleteOpen(true)}
            />
          )}
        </td>
      </tr>

      <EditStageDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        stage={stage}
        onSubmit={(values) => {
          onUpdate(values);
          setEditOpen(false);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onDelete}
        title="Delete stage"
        description="This removes the stage from the build plan. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}

function EditStageDrawer({
  open,
  onOpenChange,
  stage,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: Stage;
  onSubmit: (values: any) => void;
}) {
  const [phase, setPhase] = useState("");
  const [name, setName] = useState(stage.name);
  const [status, setStatus] = useState<StageStatus>(stage.status);
  const [startDate, setStartDate] = useState(stage.startDate ?? "");
  const [endDate, setEndDate] = useState(stage.endDate ?? "");

  useEffect(() => {
    if (open) {
      setPhase("");
      setName(stage.name);
      setStatus(stage.status);
      setStartDate(stage.startDate ?? "");
      setEndDate(stage.endDate ?? "");
    }
  }, [open, stage]);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Build Stage"
      description=""
      submitLabel="Save Changes"
      submitDisabled={!name.trim()}
      onSubmit={() =>
        onSubmit({
          name: name.trim(),
          status,
          startDate: startDate || null,
          endDate: endDate || null,
          progressPercent: stage.progressPercent,
        })
      }
      footerVariant="stacked"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-medium text-[#1E1E1E]">
            Building Phase
          </label>
          <button
            type="button"
            className="text-xs font-medium text-[#004DE7] hover:underline"
          >
            + Add Building Phase
          </button>
        </div>
        <Select
          options={[]}
          value={phase || null}
          onChange={(v) => setPhase(v ?? "")}
          placeholder="Select Phase"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[#1E1E1E]">
          Building Stage
        </label>
        <TextInput value={name} onChange={setName} placeholder="Placeholder" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[#1E1E1E]">Status</label>
        <Select
          options={[
            { value: "Pending", label: "Not started" },
            { value: "InProgress", label: "In progress" },
            { value: "Done", label: "Completed" },
          ]}
          value={status}
          onChange={(v) => v && setStatus(v as StageStatus)}
          placeholder="Select Status"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[#1E1E1E]">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-11 w-full border border-[#EBEBEB] bg-white px-3.5 text-sm outline-none focus:border-[#004DE7]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[#1E1E1E]">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-11 w-full border border-[#EBEBEB] bg-white px-3.5 text-sm outline-none focus:border-[#004DE7]"
          />
        </div>
      </div>
    </FormDrawer>
  );
}

function StageRowMenu({
  onEdit,
  onInlineEdit,
  onDelete,
}: {
  onEdit: () => void;
  onInlineEdit?: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111827]"
            aria-label="Actions"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem onSelect={() => (onInlineEdit ? onInlineEdit() : onEdit())}>Edit</DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>Edit details</DropdownMenuItem>
        <DropdownMenuItem tone="danger" onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


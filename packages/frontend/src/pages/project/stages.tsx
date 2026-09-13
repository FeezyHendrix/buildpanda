import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { BlocksIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { SearchInput } from "@/components/atoms/search-input";
import { Spinner } from "@/components/atoms/spinner";
import {
  Table,
  TableBody,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
} from "@/components/atoms/table";
import { PageHeader } from "@/components/molecules/page-header";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import {
  UpsertStageDialog,
  type UpsertStageValues,
} from "@/components/molecules/upsert-stage-dialog";
import { StageRow } from "./stages/stage-row";
import { StageValueSummaryBar } from "./stages/stage-value-summary-bar";
import { useParams } from "react-router-dom";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateStage,
  useDeleteStage,
  useReorderStages,
  useStageValueSummary,
  useStages,
  useUpdateStage,
} from "@/hooks/use-stages";
import { errorMessage } from "@/lib/api-error";
import { canResourceAction } from "@/lib/project-types";
import { icons } from "@/assets/icons/icons";

const COLUMN_COUNT = 9;

type FilterTab = "all" | "in-progress" | "completed";

const TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All stages" },
  { value: "in-progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

export default function ProjectStages() {
  const { project, access } = useProjectContext();
  const canManage = Boolean(access && canResourceAction(access, "schedule", "manage"));
  const { buildingId } = useParams<{ buildingId?: string }>();
  const { data: stages = [], isLoading } = useStages(project.id, buildingId);
  const { data: valueSummary } = useStageValueSummary(project.id);
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();
  const reorderStages = useReorderStages();

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [deletingStageId, setDeletingStageId] = useState<string | null>(null);

  const currency = project.currency ?? "NGN";
  const complete = stages.filter((s) => s.status === "Done").length;
  const inProgress = stages.filter((s) => s.status === "InProgress").length;
  const overall =
    stages.length === 0
      ? 0
      : Math.round(stages.reduce((sum, s) => sum + s.progressPercent, 0) / stages.length);

  const filtered = stages
    .filter(
      (s) =>
        filter === "all" ||
        (filter === "in-progress" && s.status === "InProgress") ||
        (filter === "completed" && s.status === "Done"),
    )
    .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  function handleCreate(values: UpsertStageValues): void {
    createStage.mutate(
      { projectId: project.id, buildingId, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  function move(index: number, dir: -1 | 1): void {
    const target = index + dir;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    const current = next[index];
    const swap = next[target];
    if (!current || !swap) return;
    next[index] = swap;
    next[target] = current;
    reorderStages.mutate({ projectId: project.id, stageIds: next.map((s) => s.id) });
  }

  function handleDelete(stageId: string, close: () => void): void {
    setDeletingStageId(stageId);
    deleteStage.mutate({ projectId: project.id, stageId }, { onSuccess: close });
  }

  return (
    <div className="w-full px-4 pt-4 pb-8 sm:px-10 lg:px-6">
      <PageHeader
        title="Build stages"
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4" />
              Add stage
            </Button>
          ) : undefined
        }
      />

      {stages.length > 0 ? (
        <section aria-label="Stage summary" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Construction progress"
            icon={icons.constructionProgress}
            progress={overall}
            helper={`${complete} of ${stages.length} stages complete`}
          />
          <KpiCard label="Total stages" value={stages.length} icon={icons.penSquare} />
          <KpiCard label="In progress" value={inProgress} icon={icons.penSquare} />
          <KpiCard label="Completed stages" value={complete} icon={icons.verified} />
        </section>
      ) : null}

      <StageValueSummaryBar summary={valueSummary} currency={currency} />

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 rounded-lg border border-line-hair bg-white lg:max-w-md">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search build stages"
            aria-label="Search build stages"
          />
        </div>
        <FilterTabs items={TABS} value={filter} onChange={setFilter} ariaLabel="Filter stages" />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-line-hair bg-white">
        <Table className="min-w-[820px]">
          <TableHead>
            <tr>
              <TableHeaderCell className="w-10 px-3" />
              <TableHeaderCell />
              <TableHeaderCell>Build stage</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell align="right">Value</TableHeaderCell>
              <TableHeaderCell>Start date</TableHeaderCell>
              <TableHeaderCell>End date</TableHeaderCell>
              <TableHeaderCell>Progress</TableHeaderCell>
              <TableHeaderCell className="w-10 px-3" />
            </tr>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableEmptyRow colSpan={COLUMN_COUNT}>
                <div className="flex justify-center py-10">
                  <Spinner size="md" />
                </div>
              </TableEmptyRow>
            ) : filtered.length === 0 ? (
              <TableEmptyRow colSpan={COLUMN_COUNT}>
                <EmptyState
                  variant="inline"
                  icon={<BlocksIcon />}
                  title={stages.length === 0 ? "No stages yet" : "No stages match your search"}
                  description={
                    stages.length === 0
                      ? "Add your first stage to start tracking the build."
                      : "Try a different search term."
                  }
                />
              </TableEmptyRow>
            ) : (
              filtered.map((stage) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  index={stages.indexOf(stage)}
                  total={stages.length}
                  canManage={canManage}
                  currency={currency}
                  unallocated={valueSummary?.unallocated}
                  deleteError={
                    deletingStageId === stage.id && deleteStage.error
                      ? errorMessage(deleteStage.error)
                      : null
                  }
                  isDeleting={deletingStageId === stage.id && deleteStage.isPending}
                  onMove={move}
                  onUpdate={(values) =>
                    updateStage.mutate({ projectId: project.id, stageId: stage.id, ...values })
                  }
                  onDelete={(close) => handleDelete(stage.id, close)}
                  onDeleteDialogChange={(open) => {
                    if (open) {
                      deleteStage.reset();
                      setDeletingStageId(stage.id);
                    }
                  }}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <UpsertStageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        currency={currency}
        unallocated={valueSummary?.unallocated}
        onSubmit={handleCreate}
        isSubmitting={createStage.isPending}
        error={createStage.error ? errorMessage(createStage.error) : null}
      />
    </div>
  );
}

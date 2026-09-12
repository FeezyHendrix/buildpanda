import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { BlocksIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { SearchInput } from "@/components/atoms/search-input";
import { Spinner } from "@/components/atoms/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/atoms/table";
import { PageHeader } from "@/components/molecules/page-header";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import { RowActionsMenu } from "@/components/molecules/row-actions-menu";
import {
  UpsertStageDialog,
  type UpsertStageValues,
} from "@/components/molecules/upsert-stage-dialog";
import { useParams } from "react-router-dom";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateStage,
  useDeleteStage,
  useReorderStages,
  useStages,
  useUpdateStage,
} from "@/hooks/use-stages";
import { canResourceAction, type Stage, type StageStatus } from "@/lib/project-types";
import { icons } from "@/assets/icons/icons";

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

function StatusCell({ status }: { status: StageStatus }) {
  if (status === "InProgress")
    return (
      <Badge tone="info" size="sm">
        In progress
      </Badge>
    );
  if (status === "Done")
    return (
      <Badge tone="success" size="sm">
        Completed
      </Badge>
    );
  return <span className="text-[13px] text-gray-400">Not started</span>;
}

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
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();
  const reorderStages = useReorderStages();

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");

  const complete = stages.filter((s) => s.status === "Done").length;
  const inProgress = stages.filter((s) => s.status === "InProgress").length;
  const overall =
    stages.length === 0
      ? 0
      : Math.round(
          stages.reduce((sum, s) => sum + s.progressPercent, 0) / stages.length,
        );

  const filtered = stages
    .filter(
      (s) =>
        filter === "all" ||
        (filter === "in-progress" && s.status === "InProgress") ||
        (filter === "completed" && s.status === "Done"),
    )
    .filter(
      (s) => !search || s.name.toLowerCase().includes(search.toLowerCase()),
    );

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
    reorderStages.mutate({
      projectId: project.id,
      stageIds: next.map((s) => s.id),
    });
  }

  return (
    <div className="w-full px-4 pt-4 pb-8 sm:px-10 lg:px-6">
      <PageHeader
        title="Build stages"
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
            >
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

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 rounded-lg border border-[#EDEDED] bg-white lg:max-w-md">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search build stages"
            aria-label="Search build stages"
          />
        </div>
        <FilterTabs items={TABS} value={filter} onChange={setFilter} ariaLabel="Filter stages" />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#F0F0F0] bg-white">
        <Table className="min-w-[700px]">
          <TableHead>
            <tr>
              <TableHeaderCell className="w-10 px-3" />
              <TableHeaderCell />
              <TableHeaderCell>Build stage</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Start date</TableHeaderCell>
              <TableHeaderCell>End date</TableHeaderCell>
              <TableHeaderCell>Progress</TableHeaderCell>
              <TableHeaderCell className="w-10 px-3" />
            </tr>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableEmptyRow colSpan={8}>
                <div className="flex justify-center py-10">
                  <Spinner size="md" />
                </div>
              </TableEmptyRow>
            ) : filtered.length === 0 ? (
              <TableEmptyRow colSpan={8}>
                <EmptyState
                  variant="inline"
                  icon={<BlocksIcon />}
                  title={stages.length === 0 ? "No stages yet" : "No stages match your search"}
                  description={stages.length === 0 ? "Add your first stage to start tracking the build." : "Try a different search term."}
                />
              </TableEmptyRow>
            ) : (
              filtered.map((stage) => {
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
              })
            )}
          </TableBody>
        </Table>
      </div>

      <UpsertStageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createStage.isPending}
        error={(createStage.error as Error | undefined)?.message ?? null}
      />
    </div>
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
  onUpdate: (values: UpsertStageValues) => void;
  onDelete: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <TableRow className="group hover:bg-[#FAFAFA]">
        <TableCell className="px-3">
          <div className="flex flex-col items-center">
            <button
              type="button"
              aria-label="Move up"
              disabled={index === 0}
              onClick={() => onMove(index, -1)}
              className="p-0 leading-none text-gray-400 hover:text-gray-900 disabled:opacity-30"
            >
              ▲
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={index === total - 1}
              onClick={() => onMove(index, 1)}
              className="p-0 leading-none text-gray-400 hover:text-gray-900 disabled:opacity-30"
            >
              ▼
            </button>
          </div>
        </TableCell>

        <TableCell>
          <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-[#F6F6F6] text-[12px] font-medium text-[#000000]">
            {index + 1}
          </span>
        </TableCell>

        <TableCell className="font-medium">{stage.name}</TableCell>

        <TableCell>
          <StatusCell status={stage.status} />
        </TableCell>

        <TableCell className="whitespace-nowrap">{formatDate(stage.startDate)}</TableCell>

        <TableCell className="whitespace-nowrap">{formatDate(stage.endDate)}</TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            <ProgressBar tone="success" value={stage.progressPercent} size="md" />
            <span className="w-8 text-right text-[12px] tabular-nums text-[#000000]">
              {stage.progressPercent}%
            </span>
          </div>
        </TableCell>

        <TableCell className="px-3">
          {canManage ? (
            <RowActionsMenu
              onEdit={() => setEditOpen(true)}
              onDelete={() => setDeleteOpen(true)}
            />
          ) : null}
        </TableCell>
      </TableRow>

      <UpsertStageDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={{
          name: stage.name,
          status: stage.status,
          startDate: stage.startDate,
          endDate: stage.endDate,
          progressPercent: stage.progressPercent,
        }}
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

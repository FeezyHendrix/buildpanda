import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertStageDialog,
  type UpsertStageValues,
} from "@/components/molecules/upsert-stage-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateStage,
  useDeleteStage,
  useReorderStages,
  useStages,
  useUpdateStage,
} from "@/hooks/use-stages";
import { cn } from "@/lib/utils";
import type { Stage, StageStatus } from "@/lib/project-types";
import { KpiCard, ProgressBar } from "@/components";
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

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All Stages" },
  { key: "in-progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

export default function ProjectStages() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const { data: stages = [], isLoading } = useStages(project.id);
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
      { projectId: project.id, ...values },
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
    <div className="w-full px-4 py-8 sm:px-10 lg:px-6">
      <Breadcrumbs
        items={[
          { label: "Schedule", to: `/project/${project.id}/schedule` },
          { label: "Build Stages" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Build Stages"
        description="Break the build into stages and track progress all the way to handover."
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

      {/* Stats row */}
      {stages.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <KpiCard
            title="Construction Progress"
            icon={icons.constructionProgress}
            progress={overall}
            complete={complete}
            total={stages.length}
            stages={true}
            className="rounded-tl-[16px] rounded-tr-[1px] rounded-br-[1px] rounded-bl-[16px] lg:col-span-6"
          />
          <KpiCard
            title="Total Stages"
            value={stages.length}
            icon={icons.penSquare}
            className="lg:col-span-2"
          />
          <KpiCard
            title="In Progress"
            value={inProgress}
            icon={icons.penSquare}
            className="lg:col-span-2"
          />
          <KpiCard
            title="Completed Stages"
            value={complete}
            icon={icons.verified}
            className="lg:col-span-2 rounded-tr-[16px] rounded-br-[16px"
          />
        </div>
      )}

      {/* Search + filter tabs */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <svg
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Build Stages"
            className="h-9 w-full rounded-lg bg-[#F8F8F8] pl-9 pr-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10 lg:text-sm"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-[#F8F8F8] p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                filter === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#F0F0F0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="border-b border-[#EDEDED] bg-[#FAFAFA]">
              <tr>
                <th className="w-10 px-3 py-3" />
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400"/>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Build Stages
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Status
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Start date
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  End date
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Progress
                </th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-gray-500"
                  >
                    Loading stages…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-gray-500"
                  >
                    {stages.length === 0
                      ? "No stages yet. Add your first stage to start tracking the build."
                      : "No stages match your search."}
                  </td>
                </tr>
              ) : (
                filtered.map((stage) => {
                  const originalIndex = stages.indexOf(stage);
                  return (
                    <StageRow
                      key={stage.id}
                      stage={stage}
                      index={originalIndex}
                      total={stages.length}
                      projectId={project.id}
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
            </tbody>
          </table>
        </div>
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
  projectId: string;
  canManage: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
  onUpdate: (values: UpsertStageValues) => void;
  onDelete: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <tr className="group hover:bg-[#FAFAFA]">
        {/* Reorder */}
        <td className="px-3 py-3">
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
        </td>

        {/* # */}
        <td className="px-4 py-3">
          <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-[#F6F6F6] text-[12px] font-medium text-[#000000]">
            {index + 1}
          </span>
        </td>

        {/* Name */}
        <td className="px-4 py-3 text-[13px] font-medium text-[#000000]">
          {stage.name}
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <StatusCell status={stage.status} />
        </td>

        {/* Start date */}
        <td className="whitespace-nowrap px-4 py-3 text-[13px] text-[#000000]">
          {formatDate(stage.startDate)}
        </td>

        {/* End date */}
        <td className="whitespace-nowrap px-4 py-3 text-[13px] text-[#000000]">
          {formatDate(stage.endDate)}
        </td>

        {/* Progress */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {/* <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#F0F0F0]">
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  stage.status === "Done" ? "bg-[#1B8E45]" : "bg-[#004DE7]",
                )}
                style={{ width: `${stage.progressPercent}%` }}
              />
            </div> */}
            <ProgressBar tone='success' value={stage.progressPercent} className={cn("bg-success-100 h-1.5")} />
            <span className="w-8 text-right text-[12px] tabular-nums text-[#000000]">
              {stage.progressPercent}%
            </span>
          </div>
        </td>

        {/* Actions */}
        <td className="px-3 py-3">
          {canManage && (
            <StageRowMenu
              onEdit={() => setEditOpen(true)}
              onDelete={() => setDeleteOpen(true)}
            />
          )}
        </td>
      </tr>

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

function StageRowMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        aria-label="Actions"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5">
          <button
            type="button"
            className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-[#F6F6F6]"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

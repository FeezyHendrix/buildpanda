import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu";
import { EmptyState } from "@/components/molecules/empty-state";
import {
  UpsertLookAheadDialog,
  type LookAheadFormValues,
} from "@/components/molecules/upsert-look-ahead-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useBuildingScope } from "@/contexts/building-scope-context";
import { useSetPageTitle } from "@/contexts/page-title-context";
import {
  useAutoWindow,
  useCreateLookAhead,
  useDeleteLookAhead,
  useLookAheads,
  useUpdateLookAhead,
} from "@/hooks/use-look-aheads";
import { canResourceAction } from "@/lib/project-types";
import type { LookAhead, LookAheadStatus } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";

const LOOK_AHEAD_STATUS_META: Record<
  LookAheadStatus,
  { label: string; tone: "neutral" | "info" | "success" }
> = {
  Draft: { label: "Draft", tone: "neutral" },
  UnderReview: { label: "Under Review", tone: "info" },
  Approved: { label: "Approved", tone: "success" },
};

const STATUS_FILTERS: Array<LookAheadStatus | "all"> = [
  "all",
  "Draft",
  "UnderReview",
  "Approved",
];

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatRange(from: string, to: string): string {
  return `${formatDate(from)} - ${formatDate(to)}`;
}

export default function ProjectLookAheads() {
  useSetPageTitle(
    "Look Ahead",
    "Plan rolling look-ahead periods by picking activities from the programme of work or imported programme, and preview what's coming up next.",
  );

  const { project, access } = useProjectContext();
  const { selectedBuildingId } = useBuildingScope();
  const canManage = canResourceAction(access, "schedule", "manage");

  const [filter, setFilter] = useState<LookAheadStatus | "all">("all");
  const { data: lookAheads = [], isLoading } = useLookAheads(project.id, {
    ...(filter === "all" ? {} : { status: filter }),
    ...(selectedBuildingId ? { buildingId: selectedBuildingId } : {}),
  });
  const { data: autoWindow, isLoading: autoWindowLoading } = useAutoWindow(
    project.id,
    4,
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LookAhead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LookAhead | null>(null);

  const createLookAhead = useCreateLookAhead();
  const updateLookAhead = useUpdateLookAhead();
  const deleteLookAhead = useDeleteLookAhead();

  function handleSubmit(values: LookAheadFormValues): void {
    if (editTarget) {
      const initialIds = new Set(
        editTarget.activities.map((a) => a.activityId),
      );
      const nextIds = new Set(values.activityIds);
      const assignActivityIds = values.activityIds.filter(
        (id) => !initialIds.has(id),
      );
      const unassignActivityIds = editTarget.activities
        .map((a) => a.activityId)
        .filter((id) => !nextIds.has(id));

      updateLookAhead.mutate(
        {
          projectId: project.id,
          lookAheadId: editTarget.id,
          name: values.name,
          description: values.description,
          status: values.status,
          startDate: values.startDate,
          endDate: values.endDate,
          totalWorkers: values.totalWorkers,
          assignActivityIds,
          unassignActivityIds,
        },
        {
          onSuccess: () => {
            setFormOpen(false);
            setEditTarget(null);
            toast("Look ahead updated", "success");
          },
          onError: () => toast("Could not update look ahead"),
        },
      );
    } else {
      createLookAhead.mutate(
        { projectId: project.id, ...values },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast("Look ahead created", "success");
          },
          onError: () => toast("Could not create look ahead"),
        },
      );
    }
  }

  return (
    <div className="w-full px-4 lg:px-8 py-6">
      {/* Coming Up */}
      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-caption-l font-semibold text-black-500">
            Coming Up
            {autoWindow
              ? ` (${formatRange(autoWindow.from, autoWindow.to)})`
              : " (—)"}
          </h2>
          {canManage && (
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setEditTarget(null);
                setFormOpen(true);
              }}
            >
              <ReactSVG src={icons2.plus} className="[&_path]:fill-white" />
              Add Look Ahead
            </Button>
          )}
        </div>

        <div className="mt-4">
          {autoWindowLoading ? (
            <div className="flex justify-center border border-dashed border-[#E5E5E5] bg-white py-10">
              <Spinner size="md" />
            </div>
          ) : !autoWindow || autoWindow.activities.length === 0 ? (
            <div className="border-[0.5px] border-dashed border-[#B9B9B9] bg-[#FAFAFA] px-4 py-6 min-h-[110px]">
              <p className="text-[13px] text-[#9CA3AF]">
                Nothing scheduled in the next 4 weeks on the project chart.
              </p>
            </div>
          ) : (
            <div className="border border-[#EBEBEB] bg-white divide-y divide-[#F0F0F0]">
              {autoWindow.activities.map((activity) => (
                <div key={activity.activityId} className="px-4 py-3.5">
                  <p className="text-[13px] font-medium text-[#1E1E1E]">
                    {activity.activityName}
                  </p>
                  <p className="mt-1 text-xs text-[#9CA3AF]">
                    {formatRange(
                      activity.plannedStartAt,
                      activity.plannedEndAt,
                    )}
                    {" · "}
                    {activity.workerCountPlanned} Crew
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Your look aheads */}
      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-body-s font-semibold text-black-500">
            Your look aheads
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((s) => {
              const isActive = filter === s;
              const label =
                s === "all" ? "All" : LOOK_AHEAD_STATUS_META[s].label;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  className={
                    isActive
                      ? "rounded-full bg-primary px-3 py-1 text-caption-m font-medium text-white"
                      : "rounded-full border-[0.5px] border-border bg-white px-3 py-1 text-caption-m font-medium text-black-500 hover:bg-[#F6F6F6]"
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="mt-3 flex justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : lookAheads.length === 0 ? (
          <div className="mt-12 flex min-h-[380px] flex-col items-center justify-center py-12">
            <EmptyState
              title="No look aheads yet"
              description="Create a look-ahead period and pick the activities it covers from the programme."
              action={
                canManage && (
                  <Button
                    size="lg"
                    onClick={() => {
                      setEditTarget(null);
                      setFormOpen(true);
                    }}
                  >
                    <ReactSVG
                      src={icons2.plus}
                      className="[&_path]:fill-white"
                    />
                    Add Look Ahead
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className="mt-3 flex flex-col">
            {lookAheads.map((lookAhead) => (
              <LookAheadRow
                key={lookAhead.id}
                lookAhead={lookAhead}
                canManage={canManage}
                onEdit={() => {
                  setEditTarget(lookAhead);
                  setFormOpen(true);
                }}
                onDelete={() => setDeleteTarget(lookAhead)}
              />
            ))}
          </div>
        )}
      </section>

      <UpsertLookAheadDialog
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditTarget(null);
        }}
        projectId={project.id}
        initial={editTarget}
        isSubmitting={createLookAhead.isPending || updateLookAhead.isPending}
        error={
          createLookAhead.error
            ? (createLookAhead.error as Error).message
            : updateLookAhead.error
              ? (updateLookAhead.error as Error).message
              : null
        }
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title={`Delete ${deleteTarget?.name ?? "this look ahead"}?`}
        description="This removes the look-ahead period. The activities it referenced stay on the programme."
        variant="danger"
        confirmLabel="Delete"
        loading={deleteLookAhead.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteLookAhead.mutate(
            { projectId: project.id, lookAheadId: deleteTarget.id },
            {
              onSuccess: () => {
                setDeleteTarget(null);
                toast("Look ahead deleted", "success");
              },
              onError: () => toast("Could not delete look ahead"),
            },
          );
        }}
      />
    </div>
  );
}

function LookAheadRow({
  lookAhead,
  canManage,
  onEdit,
  onDelete,
}: {
  lookAhead: LookAhead;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = LOOK_AHEAD_STATUS_META[lookAhead.status];
  return (
    <div className="flex items-start justify-between gap-4 border border-[#EBEBEB] bg-white px-4 py-4 -mt-px first:mt-0 hover:bg-[#FAFAFA]/60">
      <div className="min-w-0 flex-1">
        <Badge
          tone={meta.tone}
          size="sm"
          className="h-5 px-2 !text-caption-m font-medium"
        >
          {meta.label}
        </Badge>

        <p className="mt-2 text-caption-l font-semibold !text-black-500">
          {lookAhead.name}
        </p>

        {lookAhead.description && (
          <p className="mt-1.5 line-clamp-2 text-caption-l text-[#404040]">
            {lookAhead.description}
          </p>
        )}

        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-caption-m font-semibold text-grey-450">
          <span>{formatRange(lookAhead.startDate, lookAhead.endDate)}</span>
          <span className="h-3 w-px bg-[#E5E5E5]" aria-hidden />
          <span>
            {lookAhead.totalWorkers != null
              ? `${lookAhead.totalWorkers} Crew`
              : "— Crew"}
          </span>
          <span className="h-3 w-px bg-[#E5E5E5]" aria-hidden />
          <span>
            {lookAhead.activities.length}{" "}
            {lookAhead.activities.length === 1 ? "Activity" : "Activities"}
          </span>
        </p>
      </div>

      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="More actions"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#1E1E1E]"
              >
                <MoreVertical className="size-4" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-40 p-1">
            <DropdownMenuItem onSelect={onEdit} className="text-[13px]">
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              tone="danger"
              onSelect={onDelete}
              className="text-[13px]"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

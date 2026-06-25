import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertKeyDateDialog,
  type UpsertKeyDateValues,
} from "@/components/molecules/upsert-key-date-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateKeyDate,
  useDeleteKeyDate,
  useKeyDates,
  useUpdateKeyDate,
} from "@/hooks/use-key-dates";
import { formatShortDate } from "@/lib/formatters";
import type { KeyDate, KeyDateStatus } from "@/lib/project-types";

const STATUS_META: Record<
  KeyDateStatus,
  { tone: "neutral" | "success" | "danger" }
> = {
  Upcoming: { tone: "neutral" },
  Met: { tone: "success" },
  Missed: { tone: "danger" },
};

function fmt(value: string | null): string {
  return formatShortDate(value) || "-";
}

export default function ProjectKeyDates() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const { data: keyDates = [], isLoading } = useKeyDates(project.id);
  const createKd = useCreateKeyDate();
  const updateKd = useUpdateKeyDate();
  const deleteKd = useDeleteKeyDate();

  const [createOpen, setCreateOpen] = useState(false);
  const [editKd, setEditKd] = useState<KeyDate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleCreate(values: UpsertKeyDateValues): void {
    createKd.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }
  function handleEdit(values: UpsertKeyDateValues): void {
    if (!editKd) return;
    updateKd.mutate(
      { projectId: project.id, keyDateId: editKd.id, ...values },
      { onSuccess: () => setEditKd(null) },
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Schedule", to: `/project/${project.id}/schedule` },
          { label: "Key Dates" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Key Dates"
        description="The milestone dates that matter: target vs actual, so slippage is visible."
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
            >
              <PlusIcon className="size-4" />
              Add key date
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 flex flex-col gap-3">
        {isLoading ? (
          <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
        ) : keyDates.length === 0 ? (
          <Card padding="lg" className="text-center">
            <p className="text-sm font-medium text-gray-900">
              No key dates yet
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Add the milestones you want to track.
            </p>
          </Card>
        ) : (
          keyDates.map((kd) => (
            <Card key={kd.id} padding="md" className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {kd.label}
                  </p>
                  <Badge tone={STATUS_META[kd.status].tone} size="sm">
                    {kd.status}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span>Target {fmt(kd.targetDate)}</span>
                  {kd.actualDate && <span>Actual {fmt(kd.actualDate)}</span>}
                  {kd.notes && <span className="truncate">{kd.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditKd(kd)}
                  className="text-xs font-medium text-gray-500 hover:text-gray-900"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(kd.id)}
                  className="text-xs font-medium text-red-500 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </Card>
          ))
        )}
      </div>

      <UpsertKeyDateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createKd.isPending}
        error={(createKd.error as Error | undefined)?.message ?? null}
      />
      <UpsertKeyDateDialog
        open={editKd !== null}
        onOpenChange={(o) => !o && setEditKd(null)}
        mode="edit"
        initial={editKd ?? undefined}
        onSubmit={handleEdit}
        isSubmitting={updateKd.isPending}
        error={(updateKd.error as Error | undefined)?.message ?? null}
      />
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={() => {
          if (deleteId)
            deleteKd.mutate({ projectId: project.id, keyDateId: deleteId });
          setDeleteId(null);
        }}
        title="Delete key date"
        description="This permanently removes the key date."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

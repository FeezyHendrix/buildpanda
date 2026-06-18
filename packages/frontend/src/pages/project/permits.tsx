import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertPermitDialog,
  type UpsertPermitValues,
} from "@/components/molecules/upsert-permit-dialog";
import { KanbanBoard } from "@/components/molecules/kanban-board";
import { PERMIT_COLUMNS, textMeta } from "@/components/molecules/kanban-configs";
import { useProjectContext } from "@/layouts/project-layout";
import { useCreatePermit, useDeletePermit, usePermits, useUpdatePermit } from "@/hooks/use-permits";
import { formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Permit, PermitStatus } from "@/lib/project-types";

const STATUS_META: Record<PermitStatus, { label: string; tone: "neutral" | "info" | "success" | "danger" | "warning" }> = {
  NotStarted: { label: "Not started", tone: "neutral" },
  Applied: { label: "Applied", tone: "info" },
  Approved: { label: "Approved", tone: "success" },
  Rejected: { label: "Rejected", tone: "danger" },
  Expired: { label: "Expired", tone: "warning" },
};

function fmt(value: string | null): string {
  return formatShortDate(value) || "—";
}

export default function ProjectPermits() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const { data: permits = [], isLoading } = usePermits(project.id);
  const createPermit = useCreatePermit();
  const updatePermit = useUpdatePermit();
  const deletePermit = useDeletePermit();

  const [createOpen, setCreateOpen] = useState(false);
  const [editPermit, setEditPermit] = useState<Permit | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "board">("list");

  function handleMove(permit: Permit, status: PermitStatus): void {
    if (permit.status === status) return;
    updatePermit.mutate({ projectId: project.id, permitId: permit.id, status });
  }

  function handleCreate(values: UpsertPermitValues): void {
    createPermit.mutate({ projectId: project.id, ...values }, { onSuccess: () => setCreateOpen(false) });
  }
  function handleEdit(values: UpsertPermitValues): void {
    if (!editPermit) return;
    updatePermit.mutate({ projectId: project.id, permitId: editPermit.id, ...values }, { onSuccess: () => setEditPermit(null) });
  }

  return (
    <div className="w-full px-6 py-8 sm:px-10">
      <PageHeader
        title="Permits & Approvals"
        description="Regulatory permits and government approvals — track status, references and expiry."
        actions={canManage ? (
          <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            Add permit
          </Button>
        ) : undefined}
      />

      <div className="mt-6 flex justify-end">
        <div className="inline-flex rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-1">
          {(["list", "board"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "board" ? (
        <div className="mt-5">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
          ) : (
            <KanbanBoard
              items={permits}
              columns={PERMIT_COLUMNS}
              canManage={canManage}
              getId={(p) => p.id}
              getStatus={(p) => p.status}
              getTitle={(p) => p.title}
              renderMeta={(p) => textMeta(p.authority)}
              renderFooter={(p) =>
                p.expiryDate ? (
                  <span className="text-xs text-gray-500">Expires {formatShortDate(p.expiryDate)}</span>
                ) : (
                  <span className="text-xs text-gray-400">No expiry</span>
                )
              }
              onMove={handleMove}
              onOpen={(id) => {
                const permit = permits.find((p) => p.id === id);
                if (permit) setEditPermit(permit);
              }}
            />
          )}
        </div>
      ) : (
      <div className="mt-5 flex flex-col gap-3">
        {isLoading ? (
          <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
        ) : permits.length === 0 ? (
          <Card padding="lg" className="text-center">
            <p className="text-sm font-medium text-gray-900">No permits yet</p>
            <p className="mt-1 text-sm text-gray-500">Add building permits and government approvals to track them.</p>
          </Card>
        ) : (
          permits.map((p) => (
            <Card key={p.id} padding="md" className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{p.title}</p>
                  <Badge tone={STATUS_META[p.status].tone} size="sm">{STATUS_META[p.status].label}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  {p.authority && <span>{p.authority}</span>}
                  {p.referenceNo && <span>Ref {p.referenceNo}</span>}
                  {p.expiryDate && <span>Expires {fmt(p.expiryDate)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setEditPermit(p)} className="text-xs font-medium text-gray-500 hover:text-gray-900">Edit</button>
                <button type="button" onClick={() => setDeleteId(p.id)} className="text-xs font-medium text-red-500 hover:text-red-600">Delete</button>
              </div>
            </Card>
          ))
        )}
      </div>
      )}

      <UpsertPermitDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createPermit.isPending}
        error={(createPermit.error as Error | undefined)?.message ?? null}
      />
      <UpsertPermitDialog
        open={editPermit !== null}
        onOpenChange={(o) => !o && setEditPermit(null)}
        mode="edit"
        initial={editPermit ?? undefined}
        onSubmit={handleEdit}
        isSubmitting={updatePermit.isPending}
        error={(updatePermit.error as Error | undefined)?.message ?? null}
      />
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deletePermit.mutate({ projectId: project.id, permitId: deleteId });
          setDeleteId(null);
        }}
        title="Delete permit"
        description="This permanently removes the permit record."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

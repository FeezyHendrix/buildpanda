import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertChangeRequestDialog,
  type UpsertChangeValues,
} from "@/components/molecules/upsert-change-request-dialog";
import {
  ChangeRequestDetailDialog,
  CHANGE_STATUS_META,
} from "@/components/molecules/change-request-detail-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useChangeRequests,
  useCreateChangeRequest,
  useDeleteChangeRequest,
  useUpdateChangeRequest,
} from "@/hooks/use-change-requests";
import { cn } from "@/lib/utils";
import type { ChangeRequest, ChangeStatus } from "@/lib/project-mock-data";

const FILTERS: { value: ChangeStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Draft", label: "Draft" },
  { value: "Submitted", label: "Submitted" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export default function ProjectChangeRequests() {
  const { project } = useProjectContext();
  const [filter, setFilter] = useState<ChangeStatus | "all">("all");
  const { data: items = [], isLoading } = useChangeRequests(project.id, filter === "all" ? undefined : filter);
  const createCr = useCreateChangeRequest();
  const updateCr = useUpdateChangeRequest();
  const deleteCr = useDeleteChangeRequest();

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ChangeRequest | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const approvedCost = items.filter((i) => i.status === "Approved").reduce((s, i) => s + i.costImpact, 0);

  function handleCreate(values: UpsertChangeValues): void {
    createCr.mutate({ projectId: project.id, ...values }, { onSuccess: () => setCreateOpen(false) });
  }
  function handleEdit(values: UpsertChangeValues): void {
    if (!editItem) return;
    updateCr.mutate({ projectId: project.id, changeId: editItem.id, ...values }, { onSuccess: () => setEditItem(null) });
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Change Requests"
        description="Proposed changes to scope, cost or schedule — with their budget and time impact."
        actions={
          <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            New change request
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {approvedCost > 0 && <p className="text-xs text-gray-500">Approved impact: {money(approvedCost, "NGN")}</p>}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {isLoading ? (
          <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <Card padding="lg" className="text-center">
            <p className="text-sm font-medium text-gray-900">No change requests</p>
            <p className="mt-1 text-sm text-gray-500">Raise one when scope, cost or schedule changes.</p>
          </Card>
        ) : (
          items.map((cr) => (
            <Card key={cr.id} padding="md" interactive className="flex items-center gap-4">
              <button type="button" onClick={() => setDetailId(cr.id)} className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{cr.title}</p>
                  <Badge tone={CHANGE_STATUS_META[cr.status].tone} size="sm">
                    {CHANGE_STATUS_META[cr.status].label}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{money(cr.costImpact, cr.currency)}</span>
                  {cr.timeImpactDays > 0 && <span>+{cr.timeImpactDays} days</span>}
                  {cr.commentCount > 0 && <span>{cr.commentCount} comment{cr.commentCount === 1 ? "" : "s"}</span>}
                </div>
              </button>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setEditItem(cr)} className="text-xs font-medium text-gray-500 hover:text-gray-900">Edit</button>
                <button type="button" onClick={() => setDeleteId(cr.id)} className="text-xs font-medium text-red-500 hover:text-red-600">Delete</button>
              </div>
            </Card>
          ))
        )}
      </div>

      <UpsertChangeRequestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createCr.isPending}
        error={(createCr.error as Error | undefined)?.message ?? null}
      />
      <UpsertChangeRequestDialog
        open={editItem !== null}
        onOpenChange={(o) => !o && setEditItem(null)}
        mode="edit"
        initial={
          editItem
            ? {
                title: editItem.title,
                description: editItem.description,
                reason: editItem.reason,
                status: editItem.status,
                costImpact: editItem.costImpact,
                timeImpactDays: editItem.timeImpactDays,
                currency: editItem.currency,
              }
            : undefined
        }
        onSubmit={handleEdit}
        isSubmitting={updateCr.isPending}
        error={(updateCr.error as Error | undefined)?.message ?? null}
      />
      <ChangeRequestDetailDialog
        open={detailId !== null}
        onOpenChange={(o) => !o && setDetailId(null)}
        projectId={project.id}
        changeId={detailId}
      />
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteCr.mutate({ projectId: project.id, changeId: deleteId });
          setDeleteId(null);
        }}
        title="Delete change request"
        description="This permanently removes the change request and its discussion."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

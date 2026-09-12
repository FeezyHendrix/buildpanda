import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { ClipboardIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import { FilterTabs, VIEW_MODE_ITEMS } from "@/components/molecules/filter-tabs";
import { EmptyState } from "@/components/molecules/empty-state";
import {
  UpsertChangeRequestDialog,
  type UpsertChangeValues,
} from "@/components/molecules/upsert-change-request-dialog";
import {
  ChangeRequestDetailDialog,
  CHANGE_STATUS_META,
} from "@/components/molecules/change-request-detail-dialog";
import { KanbanBoard } from "@/components/molecules/kanban-board";
import { ChangeOrderSummaryStrip } from "./change-requests/summary-strip";
import { ContractChip } from "./change-requests/contract-chip";
import {
  CHANGE_COLUMNS,
  textMeta,
  assigneeFooter,
} from "@/components/molecules/kanban-configs";
import { useProjectContext } from "@/layouts/project-layout";
import { useParticipants } from "@/hooks/use-participants";
import {
  useChangeRequests,
  useChangeRequestSummary,
  useCreateChangeRequest,
  useDeleteChangeRequest,
  useUpdateChangeRequest,
} from "@/hooks/use-change-requests";
import { canResourceAction } from "@/lib/project-types";
import type { ChangeRequest, ChangeStatus } from "@/lib/project-types";
import { formatWholeCurrency } from "@/lib/formatters";

const FILTERS: { value: ChangeStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Draft", label: "Draft" },
  { value: "Submitted", label: "Submitted" },
  { value: "Approved", label: "Approved" },
  { value: "Executed", label: "Executed" },
  { value: "Rejected", label: "Rejected" },
];

function money(amount: number, currency: string): string {
  return formatWholeCurrency(amount, currency);
}

export default function ProjectChangeRequests() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "change-requests", "manage");
  const [filter, setFilter] = useState<ChangeStatus | "all">("all");
  const [view, setView] = useState<"list" | "board">("list");
  const { data: items = [], isLoading } = useChangeRequests(
    project.id,
    filter === "all" ? undefined : filter,
  );
  const { data: summary } = useChangeRequestSummary(project.id);
  const createCr = useCreateChangeRequest();
  const updateCr = useUpdateChangeRequest();
  const deleteCr = useDeleteChangeRequest();

  const { data: participants = [] } = useParticipants(project.id);
  const assigneeOptions = participants
    .filter((p) => p.userId)
    .map((p) => ({ id: p.userId as string, name: p.name ?? p.email }));

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ChangeRequest | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const approvedCost = items
    .filter((i) => i.status === "Approved" || i.status === "Executed")
    .reduce((s, i) => s + i.costImpact, 0);

  function handleMove(cr: ChangeRequest, status: ChangeStatus): void {
    if (cr.status === status) return;
    updateCr.mutate({ projectId: project.id, changeId: cr.id, status });
  }

  function handleAssign(cr: ChangeRequest, assigneeId: string | null): void {
    updateCr.mutate({ projectId: project.id, changeId: cr.id, assigneeId });
  }

  function handleCreate(values: UpsertChangeValues): void {
    createCr.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }
  function handleEdit(values: UpsertChangeValues): void {
    if (!editItem) return;
    updateCr.mutate(
      { projectId: project.id, changeId: editItem.id, ...values },
      { onSuccess: () => setEditItem(null) },
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
      <PageHeader
        title="Change orders"
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
            >
              <PlusIcon className="size-4" />
              New change order
            </Button>
          ) : undefined
        }
      />

      <ChangeOrderSummaryStrip summary={summary} items={items} className="mt-6" />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs items={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter change requests" />
        <div className="flex items-center gap-3 justify-end lg:justify-start self-end lg:self-auto">
          <FilterTabs items={VIEW_MODE_ITEMS} value={view} onChange={setView} ariaLabel="View" />
          {approvedCost > 0 && (
            <p className="text-xs text-ink-muted">
              Approved impact: {money(approvedCost, project.currency)}
            </p>
          )}
        </div>
      </div>

      {view === "board" ? (
        <div className="mt-5">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" />
            </div>
          ) : (
            <KanbanBoard
              items={items}
              columns={CHANGE_COLUMNS}
              canManage={canManage}
              getId={(cr) => cr.id}
              getStatus={(cr) => cr.status}
              getTitle={(cr) => cr.title}
              renderMeta={(cr) =>
                textMeta(
                  cr.costImpact ? money(cr.costImpact, cr.currency) : null,
                )
              }
              renderFooter={(cr) => assigneeFooter(cr.assigneeName, null)}
              onMove={handleMove}
              onOpen={setDetailId}
              assigneeOptions={assigneeOptions}
              getAssigneeId={(cr) => cr.assigneeId}
              onAssign={handleAssign}
            />
          )}
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<ClipboardIcon />}
              title="No change orders yet"
              description="Raise one when scope, cost or schedule changes."
            />
          ) : (
            items.map((cr) => (
              <Card
                key={cr.id}
                padding="md"
                interactive
                className="flex items-center gap-4"
              >
                <button
                  type="button"
                  onClick={() => setDetailId(cr.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">
                      {cr.title}
                    </p>
                    <Badge tone={CHANGE_STATUS_META[cr.status].tone} size="sm">
                      {CHANGE_STATUS_META[cr.status].label}
                    </Badge>
                    {cr.contractId ? <ContractChip projectId={project.id} contractId={cr.contractId} /> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                    <span className="font-medium text-ink">
                      {money(cr.costImpact, cr.currency)}
                    </span>
                    {cr.timeImpactDays > 0 && (
                      <span>+{cr.timeImpactDays} days</span>
                    )}
                    {cr.commentCount > 0 && (
                      <span>
                        {cr.commentCount} comment
                        {cr.commentCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </button>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditItem(cr)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteId(cr.id)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      <UpsertChangeRequestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={project.id}
        mode="create"
        assigneeOptions={assigneeOptions}
        onSubmit={handleCreate}
        isSubmitting={createCr.isPending}
        error={(createCr.error as Error | undefined)?.message ?? null}
      />
      <UpsertChangeRequestDialog
        open={editItem !== null}
        onOpenChange={(o) => !o && setEditItem(null)}
        projectId={project.id}
        mode="edit"
        assigneeOptions={assigneeOptions}
        initial={
          editItem
            ? {
                title: editItem.title,
                description: editItem.description,
                reason: editItem.reason,
                reasonHtml: editItem.reasonHtml,
                status: editItem.status,
                costImpact: editItem.costImpact,
                timeImpactDays: editItem.timeImpactDays,
                currency: editItem.currency,
                assigneeId: editItem.assigneeId,
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
          if (deleteId)
            deleteCr.mutate({ projectId: project.id, changeId: deleteId });
          setDeleteId(null);
        }}
        title="Delete change order"
        description="This permanently removes the change order and its discussion."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

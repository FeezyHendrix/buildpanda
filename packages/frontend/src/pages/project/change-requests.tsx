import { useState } from "react";
import { Button } from "@/components/atoms/button";
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
import { ChangeRequestDetailDialog } from "@/components/molecules/change-request-detail-dialog";
import { KanbanBoard } from "@/components/molecules/kanban-board";
import { ChangeOrderSummaryStrip } from "./change-requests/summary-strip";
import { ChangeRow } from "./change-requests/change-row";
import {
  CHANGE_TYPE_FILTERS,
  TimeClaimPosition,
  timeClaimDays,
  type ChangeTypeFilter,
} from "./change-requests/time-claim-position";
import {
  CHANGE_COLUMNS,
  textMeta,
  assigneeFooter,
} from "@/components/molecules/kanban-configs";
import { useProjectContext } from "@/layouts/project-layout";
import { useParticipants } from "@/hooks/use-participants";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import {
  useChangeRequestAction,
  useChangeRequests,
  useChangeRequestSummary,
  useCreateChangeRequest,
  useDeleteChangeRequest,
  useUpdateChangeRequest,
} from "@/hooks/use-change-requests";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { canResourceAction } from "@/lib/project-types";
import type { ChangeAction, ChangeRequest, ChangeStatus } from "@/lib/project-types";
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

/**
 * The action that lands a change in each board column. Rejected is absent on
 * purpose: a rejection carries a reason, which a drag cannot give it.
 */
const BOARD_ACTION: Partial<Record<ChangeStatus, ChangeAction>> = {
  Submitted: "submit",
  Approved: "approve",
  Executed: "execute",
};

export default function ProjectChangeRequests() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "change-requests", "manage");
  const [filter, setFilter] = useState<ChangeStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ChangeTypeFilter>("all");
  const [view, setView] = useState<"list" | "board">("list");
  const { data: items = [], isLoading } = useChangeRequests(
    project.id,
    filter === "all" ? undefined : filter,
  );
  const { data: summary } = useChangeRequestSummary(project.id);
  const snapshot = useReportingSnapshot(project.id);
  const createCr = useCreateChangeRequest();
  const updateCr = useUpdateChangeRequest();
  const runAction = useChangeRequestAction();
  const deleteCr = useDeleteChangeRequest();

  const { data: participants = [] } = useParticipants(project.id);
  const assigneeOptions = participants
    .filter((p) => p.userId)
    .map((p) => ({ id: p.userId as string, name: p.name ?? p.email }));

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ChangeRequest | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // The type filter is a client-side read of the loaded register: a QS wants
  // variations, omissions, time claims and provisional sums apart.
  const shown = items.filter((cr) => typeFilter === "all" || cr.type === typeFilter);
  const filtering = filter !== "all" || typeFilter !== "all";
  const approvedCost = shown
    .filter((i) => i.status === "Approved" || i.status === "Executed")
    .reduce((s, i) => s + i.costImpact, 0);

  const schedule = snapshot.data?.schedule;
  const days = timeClaimDays(items);
  const daysAwarded = schedule?.eotDaysApproved ?? days.awarded;
  const daysPending = schedule?.eotDaysPending ?? days.pending;
  // The completion position is a fact about the project, not about the rows on
  // screen, so a status filter must not make it vanish.
  const hasTimeClaims =
    daysAwarded > 0 || daysPending > 0 || items.some((cr) => cr.type === "eot_only");

  /**
   * A board drag is still a contractual decision, so it runs the action that
   * reaches that column rather than writing a status. Rejecting needs a reason,
   * which a drag cannot supply — that one opens the card instead.
   */
  function handleMove(cr: ChangeRequest, status: ChangeStatus): void {
    if (cr.status === status) return;
    const action = BOARD_ACTION[status];
    if (!action) {
      setDetailId(cr.id);
      toast("Rejecting a change needs a reason — open it to record one.");
      return;
    }
    runAction.mutate(
      { projectId: project.id, changeId: cr.id, action },
      { onError: (error) => toast(getApiErrorMessage(error), "error") },
    );
  }

  function handleAssign(cr: ChangeRequest, assigneeId: string | null): void {
    updateCr.mutate(
      { projectId: project.id, changeId: cr.id, assigneeId },
      { onError: (error) => toast(getApiErrorMessage(error), "error") },
    );
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
            <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4" />
              New change order
            </Button>
          ) : undefined
        }
      />

      <ChangeOrderSummaryStrip summary={summary} items={items} className="mt-6" />

      {hasTimeClaims ? (
        <TimeClaimPosition
          completionDate={schedule?.completionDate ?? null}
          revisedCompletionDate={schedule?.revisedCompletionDate ?? null}
          daysAwarded={daysAwarded}
          daysPending={daysPending}
        />
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <FilterTabs items={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter change requests" />
          <FilterTabs
            items={CHANGE_TYPE_FILTERS}
            value={typeFilter}
            onChange={setTypeFilter}
            ariaLabel="Filter by change type"
          />
        </div>
        <div className="flex items-center gap-3 justify-end lg:justify-start self-end lg:self-auto">
          <FilterTabs items={VIEW_MODE_ITEMS} value={view} onChange={setView} ariaLabel="View" />
          {approvedCost > 0 ? (
            <p className="text-xs text-ink-muted">
              Approved impact: {money(approvedCost, project.currency)}
            </p>
          ) : null}
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
              items={shown}
              columns={CHANGE_COLUMNS}
              canManage={canManage}
              getId={(cr) => cr.id}
              getStatus={(cr) => cr.status}
              getTitle={(cr) => cr.title}
              renderMeta={(cr) =>
                textMeta(
                  cr.type === "eot_only"
                    ? `${cr.timeImpactDays} days claimed`
                    : cr.costImpact
                      ? money(cr.costImpact, cr.currency)
                      : null,
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
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<ClipboardIcon />}
              // The status filter is applied by the server, so an empty list
              // under one means "nothing matches" — never "none exist".
              title={filtering ? "Nothing matches these filters" : "No change orders yet"}
              description={
                filtering
                  ? "Try a different status or type."
                  : "Raise one when scope, cost or schedule changes."
              }
              action={
                filtering
                  ? {
                      label: "Clear filters",
                      onClick: () => {
                        setFilter("all");
                        setTypeFilter("all");
                      },
                    }
                  : undefined
              }
            />
          ) : (
            shown.map((cr) => (
              <ChangeRow
                key={cr.id}
                cr={cr}
                projectId={project.id}
                canManage={canManage}
                onOpen={() => setDetailId(cr.id)}
                onEdit={() => setEditItem(cr)}
                onDelete={() => setDeleteId(cr.id)}
              />
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
        error={createCr.error ? getApiErrorMessage(createCr.error) : null}
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
                costImpact: editItem.costImpact,
                timeImpactDays: editItem.timeImpactDays,
                currency: editItem.currency,
                assigneeId: editItem.assigneeId,
                type: editItem.type,
                stageId: editItem.stageId,
                rfiId: editItem.rfiId,
                delayIds: editItem.delays.map((d) => d.id),
              }
            : undefined
        }
        onSubmit={handleEdit}
        isSubmitting={updateCr.isPending}
        error={updateCr.error ? getApiErrorMessage(updateCr.error) : null}
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
        loading={deleteCr.isPending}
        onConfirm={() => {
          if (!deleteId) return;
          deleteCr.mutate(
            { projectId: project.id, changeId: deleteId },
            {
              onSuccess: () => setDeleteId(null),
              // A change order with a signed contract or an executed award
              // refuses deletion with a reason; the dialog stays open on it.
              onError: (error) => toast(getApiErrorMessage(error), "error"),
            },
          );
        }}
        title="Delete change order"
        description="This permanently removes the change order and its discussion."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

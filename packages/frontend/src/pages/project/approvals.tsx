import { useUrlState } from "@/hooks/use-url-state";
import { QueryError } from "@/components/molecules/query-error";
import { useState } from "react";
import { FileCheck } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { CreateButton } from "@/components/molecules/create-button";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PageHeader } from "@/components/molecules/page-header";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { EmptyState } from "@/components/molecules/empty-state";
import {
  UpsertApprovalDialog,
  type UpsertApprovalValues,
} from "@/components/molecules/upsert-approval-dialog";
import {
  ApprovalDetailDialog,
  APPROVAL_STATUS_META,
} from "@/components/molecules/approval-detail-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useSession } from "@/stores/auth";
import { useAssignableUsers } from "@/hooks/use-tasks";
import {
  useApprovals,
  useCreateApproval,
  useDeleteApproval,
  useUpdateApproval,
} from "@/hooks/use-approvals";
import { formatDayMonth } from "@/lib/formatters";
import { canResourceAction } from "@/lib/project-types";
import type { Approval, ApprovalStatus } from "@/lib/project-types";
import { MessagesIcon } from "@/components/atoms/project-nav-icons";
import { errorMessage } from "@/lib/api-error";

const FILTERS: { value: ApprovalStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Resubmit", label: "Resubmit" },
  { value: "Rejected", label: "Rejected" },
];

function formatDue(value: string | null): string | null {
  return formatDayMonth(value) || null;
}

export default function ProjectApprovals() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "approvals", "manage");
  const canDecide = access?.capabilities?.canDecideApprovals ?? false;
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  const { data: reviewerOptions = [] } = useAssignableUsers(project.id);
  const [filter, setFilter] = useUrlState<ApprovalStatus | "all">("status", "all", FILTERS.map(f => f.value));
  const { data: approvals = [], isLoading, error: listError, refetch } = useApprovals(
    project.id,
    filter === "all" ? undefined : filter,
  );
  const createApproval = useCreateApproval();
  const updateApproval = useUpdateApproval();
  const deleteApproval = useDeleteApproval();

  const [createOpen, setCreateOpen] = useState(false);
  const [editApproval, setEditApproval] = useState<Approval | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useUrlState<string | null>("approval", null);

  function canDecideApproval(approval: Approval): boolean {
    if (!canDecide) return false;
    if (approval.requestedReviewerId && approval.requestedReviewerId !== currentUserId) {
      return false;
    }
    return true;
  }

  function handleCreate(values: UpsertApprovalValues): void {
    createApproval.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  function handleEdit(values: UpsertApprovalValues): void {
    if (!editApproval) return;
    updateApproval.mutate(
      { projectId: project.id, approvalId: editApproval.id, ...values },
      { onSuccess: () => setEditApproval(null) },
    );
  }

  const awaitingDecision = approvals.filter(a => a.status === "Pending");
  const resubmitRequested = approvals.filter(a => a.status === "Resubmit");
  const decided = approvals.filter(a => a.status === "Approved" || a.status === "Rejected");

  return (
    <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
      <PageHeader
        title="Approvals"
        actions={
          canManage ? (
            <CreateButton onClick={() => setCreateOpen(true)}>Submit for approval</CreateButton>
          ) : null
        }
      />

      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs items={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter approvals" />
        {awaitingDecision.length > 0 ? (
          <span className="text-sm text-ink-muted">{awaitingDecision.length} awaiting decision</span>
        ) : null}
      </div>

      {listError ? <QueryError error={listError} retry={refetch} noun="approvals" /> : isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size="md" />
        </div>
      ) : approvals.length === 0 && filter === "all" ? (
        <EmptyState
          icon={<FileCheck />}
          title="No approvals yet"
          description="Submit a selection or spec to get sign-off."
          action={canManage ? { label: "Submit for approval", onClick: () => setCreateOpen(true) } : undefined}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {awaitingDecision.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                Awaiting decision
                <Badge tone="neutral">{awaitingDecision.length}</Badge>
              </h3>
              <div className="flex flex-col gap-3">
                {awaitingDecision.map((a) => (
                  <ApprovalCard
                    key={a.id}
                    approval={a}
                    canManage={canManage}
                    canDecide={canDecideApproval(a)}
                    onEdit={() => setEditApproval(a)}
                    onDelete={() => setDeleteId(a.id)}
                    onClick={() => setDetailId(a.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {resubmitRequested.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                Resubmit requested
                <Badge tone="warning">{resubmitRequested.length}</Badge>
              </h3>
              <div className="flex flex-col gap-3">
                {resubmitRequested.map((a) => (
                  <ApprovalCard
                    key={a.id}
                    approval={a}
                    canManage={canManage}
                    canDecide={canDecideApproval(a)}
                    onEdit={() => setEditApproval(a)}
                    onDelete={() => setDeleteId(a.id)}
                    onClick={() => setDetailId(a.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {decided.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2 opacity-70">
                Decided
                <Badge tone="neutral">{decided.length}</Badge>
              </h3>
              <div className="flex flex-col gap-3 opacity-80 transition-opacity hover:opacity-100">
                {decided.map((a) => (
                  <ApprovalCard
                    key={a.id}
                    approval={a}
                    canManage={canManage}
                    canDecide={false}
                    onEdit={() => setEditApproval(a)}
                    onDelete={() => setDeleteId(a.id)}
                    onClick={() => setDetailId(a.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {createOpen && (
        <UpsertApprovalDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
          reviewerOptions={reviewerOptions}
          onSubmit={handleCreate}
          isSubmitting={createApproval.isPending}
          error={createApproval.error ? errorMessage(createApproval.error) : null}
        />
      )}

      {editApproval && (
        <UpsertApprovalDialog
          open={Boolean(editApproval)}
          onOpenChange={(o) => !o && setEditApproval(null)}
          mode="edit"
          initial={editApproval}
          reviewerOptions={reviewerOptions}
          onSubmit={handleEdit}
          isSubmitting={updateApproval.isPending}
          error={updateApproval.error ? errorMessage(updateApproval.error) : null}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete approval"
        description="Are you sure you want to delete this approval?"
        variant="danger"
        confirmLabel="Delete"
        loading={deleteApproval.isPending}
        onConfirm={() =>
          deleteId &&
          deleteApproval.mutate(
            { projectId: project.id, approvalId: deleteId },
            { onSuccess: () => setDeleteId(null) }
          )
        }
      />

      {detailId && (
        <ApprovalDetailDialog
          open={Boolean(detailId)}
          onOpenChange={(o) => !o && setDetailId(null)}
          projectId={project.id}
          approvalId={detailId}
          currentUserId={currentUserId}
          canDecide={canDecide}
        />
      )}
    </div>
  );
}

function ApprovalCard({
  approval,
  canManage,
  canDecide,
  onClick,
  onEdit,
  onDelete,
}: {
  approval: Approval;
  canManage: boolean;
  canDecide: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusMeta = APPROVAL_STATUS_META[approval.status];
  const due = formatDue(approval.dueDate);

  return (
    <Card className="overflow-hidden hover:border-line transition-colors group">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between p-4 gap-4" onClick={onClick} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onClick(); } }} role="button" tabIndex={0}>
        <div className="flex flex-col gap-2 flex-grow">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-ink">{approval.title}</span>
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
            {approval.commentCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-ink-muted font-medium ml-1">
                <MessagesIcon className="w-3.5 h-3.5" />
                {approval.commentCount}
              </span>
            )}
          </div>

          <div className="text-sm text-ink-muted flex flex-wrap items-center gap-2">
            <span>{approval.category}</span>
            {due && (
              <>
                <span>·</span>
                <span>due {due}</span>
              </>
            )}
            {approval.requestedReviewerName && (
              <>
                <span>·</span>
                <span>reviewer: {approval.requestedReviewerName}</span>
              </>
            )}
          </div>

          {canDecide && (approval.status === "Pending" || approval.status === "Resubmit") && (
            <div className="flex flex-wrap items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="secondary" className="border-success-500/40 text-success-600 hover:border-success-500 hover:bg-success-50 hover:text-success-700" onClick={onClick}>
                Review decision
              </Button>

            </div>
          )}
        </div>

        {canManage && (
          <div className="flex items-center gap-2 self-start opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" onClick={onEdit}>
              Edit
            </Button>
            <Button variant="danger" onClick={onDelete}>
              Delete
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

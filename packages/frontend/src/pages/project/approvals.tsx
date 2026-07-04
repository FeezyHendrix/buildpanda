import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PageHeader } from "@/components/molecules/page-header";
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
import { cn } from "@/lib/utils";
import { formatDayMonth } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import type { Approval, ApprovalStatus } from "@/lib/project-types";
import { MessagesIcon } from "@/components/atoms/project-nav-icons";

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
  const canManage = access?.capabilities?.canManage ?? false;
  const canDecide = access?.capabilities?.canDecideApprovals ?? false;
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  const { data: reviewerOptions = [] } = useAssignableUsers(project.id);
  const [filter, setFilter] = useState<ApprovalStatus | "all">("all");
  const { data: approvals = [], isLoading } = useApprovals(
    project.id,
    filter === "all" ? undefined : filter,
  );
  const createApproval = useCreateApproval();
  const updateApproval = useUpdateApproval();
  const deleteApproval = useDeleteApproval();

  const [createOpen, setCreateOpen] = useState(false);
  const [editApproval, setEditApproval] = useState<Approval | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

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

  function handleDecision(approvalId: string, status: ApprovalStatus) {
    updateApproval.mutate(
      { projectId: project.id, approvalId, status },
      {
        onSuccess: () => {
          const msg =
            status === "Approved" ? "Approval approved" :
            status === "Rejected" ? "Approval rejected" :
            status === "Resubmit" ? "Resubmission requested" :
            "Status updated";
          toast(msg, status === "Approved" ? "success" : status === "Rejected" ? "error" : "info");
        }
      }
    );
  }

  const awaitingDecision = approvals.filter(a => a.status === "Pending");
  const resubmitRequested = approvals.filter(a => a.status === "Resubmit");
  const decided = approvals.filter(a => a.status === "Approved" || a.status === "Rejected");

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="Client Approvals"
        description="Selections and specs awaiting the client's sign-off."
        actions={
          canManage ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              Submit for approval
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-8">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              filter === f.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div>Loading approvals...</div>
      ) : approvals.length === 0 && filter === "all" ? (
        <Card className="p-8 text-center mt-8">
          <h3 className="text-lg font-medium text-gray-900">No approvals</h3>
          <p className="mt-2 text-gray-500">Submit a selection or spec to get sign-off.</p>
          {canManage && (
            <Button variant="primary" className="mt-4" onClick={() => setCreateOpen(true)}>
              Submit for approval
            </Button>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {awaitingDecision.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
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
                    onDecide={handleDecision}
                  />
                ))}
              </div>
            </section>
          )}

          {resubmitRequested.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
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
                    onDecide={handleDecision}
                  />
                ))}
              </div>
            </section>
          )}

          {decided.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2 opacity-70">
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
                    onDecide={handleDecision}
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
          error={createApproval.error?.message}
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
          error={updateApproval.error?.message}
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
          canDecide={
            approvals.find((a) => a.id === detailId)
              ? canDecideApproval(approvals.find((a) => a.id === detailId)!)
              : false
          }
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
  onDecide,
}: {
  approval: Approval;
  canManage: boolean;
  canDecide: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDecide: (id: string, status: ApprovalStatus) => void;
}) {
  const statusMeta = APPROVAL_STATUS_META[approval.status];
  const due = formatDue(approval.dueDate);

  return (
    <Card className="overflow-hidden hover:border-gray-300 transition-colors group">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between p-4 gap-4" onClick={onClick} role="button" tabIndex={0}>
        <div className="flex flex-col gap-2 flex-grow">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-900">{approval.title}</span>
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
            {approval.commentCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500 font-medium ml-1">
                <MessagesIcon className="w-3.5 h-3.5" />
                {approval.commentCount}
              </span>
            )}
          </div>

          <div className="text-sm text-gray-500 flex flex-wrap items-center gap-2">
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
              <Button size="sm" variant="secondary" className="text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200 border" onClick={() => onDecide(approval.id, "Approved")}>
                Approve
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onDecide(approval.id, "Resubmit")}>
                Request changes
              </Button>
              <Button size="sm" variant="secondary" className="text-red-700 hover:text-red-800 hover:bg-red-50 border-red-200 border" onClick={() => onDecide(approval.id, "Rejected")}>
                Reject
              </Button>
            </div>
          )}
        </div>

        {canManage && (
          <div className="flex items-center gap-2 self-start opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" onClick={onEdit}>
              Edit
            </Button>
            <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={onDelete}>
              Delete
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

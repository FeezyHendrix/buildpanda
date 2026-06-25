import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertApprovalDialog,
  type UpsertApprovalValues,
} from "@/components/molecules/upsert-approval-dialog";
import {
  ApprovalDetailDialog,
  APPROVAL_STATUS_META,
} from "@/components/molecules/approval-detail-dialog";
import { KanbanBoard } from "@/components/molecules/kanban-board";
import {
  APPROVAL_COLUMNS,
  assigneeFooter,
  textMeta,
} from "@/components/molecules/kanban-configs";
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
import type { Approval, ApprovalStatus } from "@/lib/project-types";

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
  const [view, setView] = useState<"list" | "board">("list");
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

  const pendingCount = approvals.filter((a) => a.status === "Pending").length;

  // Whether the current user may record a decision on THIS approval: they must
  // be an approver (canDecide), and if a specific reviewer was requested it must
  // be them. Mirrors the backend gate so the UI never offers a blocked action.
  function canDecideApproval(a: Approval): boolean {
    if (!canDecide) return false;
    if (a.requestedReviewerId && a.requestedReviewerId !== currentUserId)
      return false;
    return true;
  }

  function handleMove(approval: Approval, status: ApprovalStatus): void {
    if (approval.status === status) return;
    updateApproval.mutate({
      projectId: project.id,
      approvalId: approval.id,
      status,
    });
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

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="Approvals"
        description="Submit selections and specs for sign-off, and track what's awaiting a decision."
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
            >
              <PlusIcon className="size-4" />
              Submit for approval
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 flex flex-col lg:flex-row flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-1 overflow-x-auto max-w-full lg:max-w-[657px]">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end lg:justify-start gap-3 self-end lg:self-auto">
          <div className="inline-flex rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-1">
            {(["list", "board"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  view === v
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {pendingCount} awaiting sign-off
          </p>
        </div>
      </div>

      {view === "board" ? (
        <div className="mt-5">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
          ) : (
            <KanbanBoard
              items={approvals}
              columns={APPROVAL_COLUMNS}
              canManage={canManage}
              getId={(a) => a.id}
              getStatus={(a) => a.status}
              getTitle={(a) => a.title}
              renderMeta={(a) => textMeta(a.category)}
              renderFooter={(a) => assigneeFooter(a.reviewedByName, a.dueDate)}
              onMove={handleMove}
              onOpen={setDetailId}
            />
          )}
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
          ) : approvals.length === 0 ? (
            <Card padding="lg" className="text-center">
              <p className="text-sm font-medium text-gray-900">No approvals</p>
              <p className="mt-1 text-sm text-gray-500">
                Submit a selection or spec to get sign-off.
              </p>
            </Card>
          ) : (
            approvals.map((a) => (
              <Card
                key={a.id}
                padding="md"
                interactive
                className="flex items-center gap-4"
              >
                <button
                  type="button"
                  onClick={() => setDetailId(a.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {a.title}
                    </p>
                    <Badge tone={APPROVAL_STATUS_META[a.status].tone} size="sm">
                      {APPROVAL_STATUS_META[a.status].label}
                    </Badge>
                    {a.category && (
                      <Badge tone="neutral" size="sm">
                        {a.category}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {formatDue(a.dueDate) && (
                      <span>Needed by {formatDue(a.dueDate)}</span>
                    )}
                    {a.commentCount > 0 && (
                      <span>
                        {a.commentCount} comment
                        {a.commentCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  {a.status === "Pending" && canDecideApproval(a) && (
                    <button
                      type="button"
                      onClick={() => setDetailId(a.id)}
                      className="rounded-md bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600"
                    >
                      Review
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditApproval(a)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-900"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(a.id)}
                    className="text-xs font-medium text-red-500 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <UpsertApprovalDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        reviewerOptions={reviewerOptions}
        onSubmit={handleCreate}
        isSubmitting={createApproval.isPending}
        error={(createApproval.error as Error | undefined)?.message ?? null}
      />

      <UpsertApprovalDialog
        open={editApproval !== null}
        onOpenChange={(o) => !o && setEditApproval(null)}
        mode="edit"
        reviewerOptions={reviewerOptions}
        initial={
          editApproval
            ? {
                title: editApproval.title,
                category: editApproval.category,
                description: editApproval.description,
                dueDate: editApproval.dueDate,
                requestedReviewerId: editApproval.requestedReviewerId,
              }
            : undefined
        }
        onSubmit={handleEdit}
        isSubmitting={updateApproval.isPending}
        error={(updateApproval.error as Error | undefined)?.message ?? null}
      />

      <ApprovalDetailDialog
        open={detailId !== null}
        onOpenChange={(o) => !o && setDetailId(null)}
        projectId={project.id}
        approvalId={detailId}
        canDecide={canDecide}
        currentUserId={currentUserId}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={() => {
          if (deleteId)
            deleteApproval.mutate({
              projectId: project.id,
              approvalId: deleteId,
            });
          setDeleteId(null);
        }}
        title="Delete approval"
        description="This permanently removes the approval and its discussion."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

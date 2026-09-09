import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { PageHeader } from "@/components/molecules/page-header";
import { MaterialApprovalCard } from "@/components/molecules/material-approval-card";
import { MaterialApprovalDetailDialog } from "@/components/molecules/material-approval-detail-dialog";
import {
  MaterialApprovalDecisionDialog,
  type MaterialDecision,
} from "@/components/molecules/material-approval-decision-dialog";
import {
  UpsertMaterialApprovalDialog,
  type UpsertMaterialApprovalValues,
} from "@/components/molecules/upsert-material-approval-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useAssignableUsers } from "@/hooks/use-tasks";
import {
  useCreateMaterialApproval,
  useDeleteMaterialApproval,
  useMaterialApprovals,
  useUpdateMaterialApproval,
} from "@/hooks/use-material-approvals";
import { useSession } from "@/stores/auth";
import { canResourceAction } from "@/lib/project-types";
import type { ApprovalStatus } from "@/lib/project-types";
import type { MaterialApproval } from "@/api/material-approvals";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type StatusFilter = ApprovalStatus | "all";

const FILTERS: readonly { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "Resubmit", label: "Resubmit" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
] as const;

const DECISION_TOAST: Record<MaterialDecision, string> = {
  Approved: "Material approved",
  Rejected: "Material rejected",
  Resubmit: "Resubmission requested",
};

interface PendingDecision {
  approval: MaterialApproval;
  decision: MaterialDecision;
}

export default function ProjectMaterialApprovals() {
  const { project, access } = useProjectContext();
  const canRequest = canResourceAction(access, "materials", "request");
  const canApprove = canResourceAction(access, "materials", "approve");
  const canComment = canResourceAction(access, "comments", "post");
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  const { data: reviewerOptions = [] } = useAssignableUsers(project.id);

  const [filter, setFilter] = useState<StatusFilter>("all");
  const { data: approvals = [], isPending } = useMaterialApprovals(
    project.id,
    filter === "all" ? undefined : filter,
  );

  const createApproval = useCreateMaterialApproval();
  const updateApproval = useUpdateMaterialApproval();
  const deleteApproval = useDeleteMaterialApproval();

  const [createOpen, setCreateOpen] = useState(false);
  const [editApproval, setEditApproval] = useState<MaterialApproval | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);

  /**
   * Mirrors the backend guard: holding materials:approve is not a licence to
   * sign off a request that names somebody else as its reviewer.
   */
  function mayDecide(approval: MaterialApproval): boolean {
    if (!canApprove) return false;
    return !approval.requestedReviewerId || approval.requestedReviewerId === currentUserId;
  }

  function handleCreate(values: UpsertMaterialApprovalValues): void {
    createApproval.mutate(
      { projectId: project.id, ...values },
      {
        onSuccess: () => {
          setCreateOpen(false);
          toast("Material approval requested", "success");
        },
      },
    );
  }

  function handleEdit(values: UpsertMaterialApprovalValues): void {
    if (!editApproval) return;
    updateApproval.mutate(
      { projectId: project.id, approvalId: editApproval.id, ...values },
      { onSuccess: () => setEditApproval(null) },
    );
  }

  function handleDecision(response: string | null): void {
    if (!pendingDecision) return;
    const { approval, decision } = pendingDecision;
    updateApproval.mutate(
      { projectId: project.id, approvalId: approval.id, status: decision, response },
      {
        onSuccess: () => {
          setPendingDecision(null);
          toast(DECISION_TOAST[decision], decision === "Rejected" ? "error" : "success");
        },
        onError: () => toast("Could not record the decision"),
      },
    );
  }

  const awaiting = approvals.filter((a) => a.status === "Pending");
  const resubmit = approvals.filter((a) => a.status === "Resubmit");
  const decided = approvals.filter((a) => a.status === "Approved" || a.status === "Rejected");

  const sections: readonly {
    key: string;
    title: string;
    tone: "neutral" | "warning";
    items: MaterialApproval[];
    muted: boolean;
  }[] = [
    { key: "awaiting", title: "Awaiting decision", tone: "neutral", items: awaiting, muted: false },
    { key: "resubmit", title: "Resubmit requested", tone: "warning", items: resubmit, muted: false },
    { key: "decided", title: "Decided", tone: "neutral", items: decided, muted: true },
  ];

  const createButton = canRequest ? (
    <Button variant="primary" onClick={() => setCreateOpen(true)}>
      Request approval
    </Button>
  ) : null;

  return (
    <div className="w-full px-4 py-8 sm:px-10 lg:px-6">
      <PageHeader
        title="Material Approvals"
        description="Materials and specifications awaiting sign-off before they are ordered or installed."
        actions={createButton}
      />

      <div className="mb-8 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              filter === f.value
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : approvals.length === 0 ? (
        <Card className="mt-8 p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900">
            {filter === "all" ? "No material approval requests" : `No ${filter.toLowerCase()} requests`}
          </h3>
          <p className="mt-2 text-gray-500">
            Raise a request to get a material and its specification signed off.
          </p>
          {canRequest ? (
            <Button variant="primary" className="mt-4" onClick={() => setCreateOpen(true)}>
              Request approval
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {sections.map((section) =>
            section.items.length > 0 ? (
              <section key={section.key}>
                <h3
                  className={cn(
                    "mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900",
                    section.muted && "opacity-70",
                  )}
                >
                  {section.title}
                  <Badge tone={section.tone}>{section.items.length}</Badge>
                </h3>
                <div
                  className={cn(
                    "flex flex-col gap-3",
                    section.muted && "opacity-80 transition-opacity hover:opacity-100",
                  )}
                >
                  {section.items.map((approval) => (
                    <MaterialApprovalCard
                      key={approval.id}
                      approval={approval}
                      canManage={canRequest}
                      canDecide={!section.muted && mayDecide(approval)}
                      onOpen={() => setDetailId(approval.id)}
                      onEdit={() => setEditApproval(approval)}
                      onDelete={() => setDeleteId(approval.id)}
                      onDecide={(target, decision) =>
                        setPendingDecision({ approval: target, decision })
                      }
                    />
                  ))}
                </div>
              </section>
            ) : null,
          )}
        </div>
      )}

      {createOpen ? (
        <UpsertMaterialApprovalDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
          reviewerOptions={reviewerOptions}
          onSubmit={handleCreate}
          isSubmitting={createApproval.isPending}
          error={createApproval.error?.message}
        />
      ) : null}

      {editApproval ? (
        <UpsertMaterialApprovalDialog
          open
          onOpenChange={(o) => !o && setEditApproval(null)}
          mode="edit"
          initial={editApproval}
          reviewerOptions={reviewerOptions}
          onSubmit={handleEdit}
          isSubmitting={updateApproval.isPending}
          error={updateApproval.error?.message}
        />
      ) : null}

      {pendingDecision ? (
        <MaterialApprovalDecisionDialog
          open
          onOpenChange={(o) => !o && setPendingDecision(null)}
          decision={pendingDecision.decision}
          materialName={pendingDecision.approval.materialName}
          onSubmit={handleDecision}
          isSubmitting={updateApproval.isPending}
          error={updateApproval.error?.message}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete material request"
        description="This removes the request and its discussion. This cannot be undone."
        variant="danger"
        confirmLabel="Delete"
        loading={deleteApproval.isPending}
        onConfirm={() =>
          deleteId
            ? deleteApproval.mutate(
                { projectId: project.id, approvalId: deleteId },
                { onSuccess: () => setDeleteId(null) },
              )
            : undefined
        }
      />

      {detailId ? (
        <MaterialApprovalDetailDialog
          open
          onOpenChange={(o) => !o && setDetailId(null)}
          projectId={project.id}
          approvalId={detailId}
          canComment={canComment}
        />
      ) : null}
    </div>
  );
}

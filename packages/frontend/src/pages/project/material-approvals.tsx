import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { SearchInput } from "@/components/atoms/search-input";
import { PageHeader } from "@/components/molecules/page-header";
import { FilterTabs } from "@/components/molecules/filter-tabs";
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
import type { MaterialApproval } from "@/api/material-approvals";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-error";
import { ApprovalsTable } from "./material-approvals/approvals-table";
import {
  APPROVAL_STATUS_FILTERS,
  isAwaitingDecision,
  matchesApprovalSearch,
  type ApprovalStatusFilter,
} from "./material-approvals/approval-helpers";

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

  // One fetch for the whole register; the status tabs narrow it here so the
  // counts on the tabs stay true whichever tab is open.
  const { data: approvals = [], isPending } = useMaterialApprovals(project.id);

  const [filter, setFilter] = useState<ApprovalStatusFilter>("all");
  const [search, setSearch] = useState("");

  const createApproval = useCreateMaterialApproval();
  const updateApproval = useUpdateMaterialApproval();
  const deleteApproval = useDeleteMaterialApproval();

  const [createOpen, setCreateOpen] = useState(false);
  const [editApproval, setEditApproval] = useState<MaterialApproval | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);

  const nameById = useMemo(
    () => new Map(reviewerOptions.map((option) => [option.id, option.name])),
    [reviewerOptions],
  );

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

  const awaitingCount = approvals.filter(isAwaitingDecision).length;
  const statusItems = APPROVAL_STATUS_FILTERS.map((item) => ({
    ...item,
    count:
      item.value === "all"
        ? approvals.length
        : approvals.filter((a) => a.status === item.value).length,
  }));

  const filtered = approvals
    .filter((approval) => filter === "all" || approval.status === filter)
    .filter((approval) => matchesApprovalSearch(approval, search));
  const isFiltered = filter !== "all" || search.trim() !== "";

  function clearFilters(): void {
    setFilter("all");
    setSearch("");
  }

  return (
    <div className="w-full px-4 pt-4 pb-8 sm:px-10 lg:px-6">
      <PageHeader
        title="Material Approvals"
        actions={
          canRequest ? (
            <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
              Request approval
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs rounded-lg border border-line-hair bg-white">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by material or supplier"
            aria-label="Search material approvals"
          />
        </div>
        <FilterTabs
          items={statusItems}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter material approvals"
        />
        <span className="ml-auto text-sm text-ink-muted">
          {filtered.length} of {approvals.length} request{approvals.length === 1 ? "" : "s"}
          {awaitingCount > 0 ? ` · ${awaitingCount} awaiting decision` : ""}
        </span>
      </div>

      <ApprovalsTable
        approvals={filtered}
        isPending={isPending}
        isFiltered={isFiltered}
        canManage={canRequest}
        mayDecide={mayDecide}
        requesterName={(approval) =>
          approval.submittedById ? (nameById.get(approval.submittedById) ?? null) : null
        }
        onCreate={() => setCreateOpen(true)}
        onClearFilters={clearFilters}
        onOpen={(approval) => setDetailId(approval.id)}
        onEdit={setEditApproval}
        onDelete={(approval) => setDeleteId(approval.id)}
        onDecide={(approval, decision) => setPendingDecision({ approval, decision })}
      />

      {createOpen ? (
        <UpsertMaterialApprovalDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
          reviewerOptions={reviewerOptions}
          onSubmit={handleCreate}
          isSubmitting={createApproval.isPending}
          error={createApproval.error ? errorMessage(createApproval.error) : null}
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
          error={updateApproval.error ? errorMessage(updateApproval.error) : null}
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
          error={updateApproval.error ? errorMessage(updateApproval.error) : null}
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

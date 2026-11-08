import { useState } from "react";
import { FileCheck } from "lucide-react";
import { useUrlState } from "@/hooks/use-url-state";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { QueryError } from "@/components/molecules/query-error";
import { CreateButton } from "@/components/molecules/create-button";
import { Spinner } from "@/components/atoms/spinner";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { EmptyState } from "@/components/molecules/empty-state";
import { NumberedPagination } from "@/components/molecules/numbered-pagination";
import { ToolbarSearch } from "@/components/molecules/toolbar-search";
import {
  UpsertApprovalDialog,
  type UpsertApprovalValues,
} from "@/components/molecules/upsert-approval-dialog";
import { ApprovalDetailDialog } from "@/components/molecules/approval-detail-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useApprovalCategories,
  useApprovalPage,
  useApprovers,
  useCreateApproval,
  useDeleteApproval,
  useUpdateApproval,
} from "@/hooks/use-approvals";
import { canResourceAction } from "@/lib/project-types";
import type { Approval } from "@/lib/project-types";
import { errorFieldName, errorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { filesApi } from "@/api/files";
import { APPROVAL_ATTACHMENTS_ENABLED, type ApprovalPageQuery } from "@/api/approvals";
import { ApprovalItem } from "./approvals/approval-item";
import { ApprovalsFilterPanel } from "./approvals/approvals-filter-panel";
import { APPROVAL_FILTERS, filterToQuery, type ApprovalFilter } from "./approvals/shared";

const PAGE_SIZE = 10;
const FILTER_VALUES = APPROVAL_FILTERS.map((f) => f.value);

export default function ProjectApprovals() {
  useSetPageTitle("Approvals", "Sign-offs on selections, specs and changes, with who decided and why.");
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "approvals", "manage");
  const { data: reviewerOptions = [] } = useApprovers(project.id);
  const { data: categories = [] } = useApprovalCategories(project.id);

  const [filter, setFilter] = useUrlState<ApprovalFilter>("status", "all", FILTER_VALUES);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  // The server filters, sorts (attention first) and pages the register, and
  // decides "Needs my approval" from who the viewer is.
  const query: ApprovalPageQuery = {
    ...filterToQuery(filter),
    q: search.trim() || undefined,
    submittedFrom: dateFrom || undefined,
    submittedTo: dateTo || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, isLoading, error: listError, refetch } = useApprovalPage(project.id, query);
  const createApproval = useCreateApproval();
  const updateApproval = useUpdateApproval();
  const deleteApproval = useDeleteApproval();

  const [createOpen, setCreateOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editApproval, setEditApproval] = useState<Approval | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useUrlState<string | null>("approval", null);

  async function handleCreate({ files = [], ...values }: UpsertApprovalValues): Promise<void> {
    let attachments: { fileId: string }[] | undefined;
    if (APPROVAL_ATTACHMENTS_ENABLED && files.length > 0) {
      setUploading(true);
      try {
        const uploaded = await Promise.all(files.map((file) => filesApi.upload(file, undefined, project.id)));
        attachments = uploaded.map((file) => ({ fileId: file.id }));
      } catch (error) {
        toast(errorMessage(error, "Could not upload the attachments"), "error");
        return;
      } finally {
        setUploading(false);
      }
    }
    createApproval.mutate(
      { projectId: project.id, ...values, ...(attachments ? { attachments } : {}) },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  function handleEdit({ files: _files, ...values }: UpsertApprovalValues): void {
    if (!editApproval) return;
    updateApproval.mutate(
      { projectId: project.id, approvalId: editApproval.id, ...values },
      { onSuccess: () => setEditApproval(null) },
    );
  }

  function handleApprove(approval: Approval): void {
    updateApproval.mutate(
      { projectId: project.id, approvalId: approval.id, status: "Approved" },
      {
        onSuccess: () => toast("Approval approved", "success"),
        onError: () => toast("Could not record the decision"),
      },
    );
  }

  const pageItems = data?.items ?? [];
  const total = data?.total ?? 0;
  const counts = data?.counts;
  const registerSize = counts ? counts.needsMe + counts.awaiting + counts.approved + counts.rejected + counts.changesRequested : 0;
  const isFiltered = filter !== "all" || search.trim() !== "" || dateFrom !== "" || dateTo !== "";
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  function resetFilters(): void {
    setFilter("all");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <div className="w-full px-4 pb-8 pt-6 lg:px-8">
      {listError ? (
        <QueryError error={listError} retry={refetch} noun="approvals" />
      ) : isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size="md" />
        </div>
      ) : registerSize === 0 && !isFiltered ? (
        <EmptyState
          icon={<FileCheck />}
          title="No approvals yet"
          description="Submit a selection or spec to get sign-off."
          action={canManage ? { label: "New approval request", onClick: () => setCreateOpen(true) } : undefined}
        />
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ToolbarSearch
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                placeholder="Search Keyword"
                ariaLabel="Search approvals"
                className="max-w-[396px]"
                inputClassName="h-11"
              />
              {canManage ? (
                <CreateButton onClick={() => setCreateOpen(true)} className="h-11 px-5">
                  New approval request
                </CreateButton>
              ) : null}
            </div>

            <div className="mt-4 divide-y divide-[#EBEBEB] border border-[#EBEBEB] bg-white">
              {pageItems.length === 0 ? (
                <EmptyState
                  variant="inline"
                  title="No approvals match these filters"
                  description="Nothing in the register falls under this view."
                  action={isFiltered ? { label: "Clear filters", onClick: resetFilters } : undefined}
                />
              ) : (
                pageItems.map((a) => (
                  <ApprovalItem
                    key={a.id}
                    approval={a}
                    mayDecide={a.viewerCanDecide}
                    canManage={canManage}
                    approving={updateApproval.isPending && updateApproval.variables?.approvalId === a.id}
                    onOpen={() => setDetailId(a.id)}
                    onApprove={() => handleApprove(a)}
                    onEdit={() => setEditApproval(a)}
                    onDelete={() => setDeleteId(a.id)}
                  />
                ))
              )}
            </div>

            {total > 0 ? (
              <NumberedPagination
                page={currentPage}
                pageSize={PAGE_SIZE}
                total={total}
                noun="Approvals"
                onPageChange={setPage}
              />
            ) : null}
          </div>

          <div className="w-full lg:sticky lg:top-6 lg:w-[291px] lg:shrink-0">
            <ApprovalsFilterPanel
              status={filter}
              counts={counts}
              onStatusChange={(value) => {
                setFilter(value);
                setPage(1);
              }}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onApplyDates={(from, to) => {
                setDateFrom(from);
                setDateTo(to);
                setPage(1);
              }}
              onReset={resetFilters}
            />
          </div>
        </div>
      )}

      {createOpen && (
        <UpsertApprovalDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
          reviewerOptions={reviewerOptions}
          categoryOptions={categories.map((c) => c.name)}
          onSubmit={(values) => void handleCreate(values)}
          isSubmitting={createApproval.isPending || uploading}
          attachmentsEnabled={APPROVAL_ATTACHMENTS_ENABLED}
          error={createApproval.error ? errorMessage(createApproval.error) : null}
          errorField={errorFieldName(createApproval.error)}
        />
      )}

      {editApproval && (
        <UpsertApprovalDialog
          open={Boolean(editApproval)}
          onOpenChange={(o) => !o && setEditApproval(null)}
          mode="edit"
          initial={editApproval}
          reviewerOptions={reviewerOptions}
          categoryOptions={categories.map((c) => c.name)}
          onSubmit={handleEdit}
          isSubmitting={updateApproval.isPending}
          error={updateApproval.error ? errorMessage(updateApproval.error) : null}
          errorField={errorFieldName(updateApproval.error)}
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
        />
      )}
    </div>
  );
}

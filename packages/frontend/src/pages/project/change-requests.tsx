import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { NumberedPagination } from "@/components/molecules/numbered-pagination";
import { Spinner } from "@/components/atoms/spinner";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { ClipboardIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import {
  UpsertChangeRequestDialog,
  type UpsertChangeValues,
} from "@/components/molecules/upsert-change-request-dialog";
import { ChangeRequestDetailDialog } from "@/components/molecules/change-request-detail-dialog";
import { ChangeFilterPanel } from "./change-requests/change-filter-panel";
import {
  noChangeFilters,
  type ChangeFilterValues,
  type StatusFilter,
} from "./change-requests/shared";
import { ChangeRow } from "./change-requests/change-row";
import { TimeClaimPosition, timeClaimDays } from "./change-requests/time-claim-position";
import { useProjectContext } from "@/layouts/project-layout";
import { useParticipants } from "@/hooks/use-participants";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import {
  useChangeRequestAction,
  useChangeRequestPage,
  useCreateChangeRequest,
  useDeleteChangeRequest,
  useUpdateChangeRequest,
} from "@/hooks/use-change-requests";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { canResourceAction } from "@/lib/project-types";
import type { ChangeRequest } from "@/lib/project-types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
const EMPTY_CHANGES: ChangeRequest[] = [];

export default function ProjectChangeRequests() {
  useSetPageTitle("Change Requests", "Scope, cost and time changes, and the decisions that settle them.");
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "change-requests", "manage");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [applied, setApplied] = useState<ChangeFilterValues>(() => noChangeFilters(project.currency));
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // The server filters and pages the register (docs/change-requests-page-backend.md).
  const costFrom = applied.costFrom.trim() === "" ? undefined : Number(applied.costFrom);
  const costTo = applied.costTo.trim() === "" ? undefined : Number(applied.costTo);
  const { data: pageData, isLoading } = useChangeRequestPage(project.id, {
    status: filter === "all" ? undefined : filter,
    q: search.trim() || undefined,
    type: applied.type === "all" ? undefined : [applied.type],
    currency: costFrom !== undefined || costTo !== undefined ? applied.currency : undefined,
    costFrom: Number.isFinite(costFrom) ? costFrom : undefined,
    costTo: Number.isFinite(costTo) ? costTo : undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const items = pageData?.items ?? EMPTY_CHANGES;
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

  const shown = items;
  const total = pageData?.total ?? 0;
  const filtering =
    filter !== "all" || search.trim() !== "" || applied.type !== "all" || applied.costFrom !== "" || applied.costTo !== "";
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = items;

  function clearFilters(): void {
    setFilter("all");
    setSearch("");
    setApplied(noChangeFilters(project.currency));
    setPage(1);
  }

  const schedule = snapshot.data?.schedule;
  const days = timeClaimDays(items);
  const daysAwarded = schedule?.eotDaysApproved ?? days.awarded;
  const daysPending = schedule?.eotDaysPending ?? days.pending;
  // The completion position is a fact about the project, not about the rows on
  // screen, so a status filter must not make it vanish.
  const hasTimeClaims =
    daysAwarded > 0 || daysPending > 0 || items.some((cr) => cr.type === "eot_only");

  // "Send for approval" creates and submits in one request; a refused submit
  // leaves no half-sent draft behind, so the error is the whole story.
  function handleCreate(values: UpsertChangeValues): void {
    createCr.mutate(
      { projectId: project.id, ...values, submit: true },
      {
        onSuccess: () => {
          setCreateOpen(false);
          toast("Change request sent for approval", "success");
        },
      },
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
    <div className="w-full px-4 pb-8 pt-[40px] lg:px-[40px]">
      {hasTimeClaims ? (
        <TimeClaimPosition
          completionDate={schedule?.completionDate ?? null}
          revisedCompletionDate={schedule?.revisedCompletionDate ?? null}
          daysAwarded={daysAwarded}
          daysPending={daysPending}
        />
      ) : null}

      <div className={cn("grid items-start gap-x-[40px] gap-y-[15px] lg:grid-cols-[minmax(0,1fr)_291px] lg:grid-rows-[auto_1fr]", hasTimeClaims && "mt-[24px]")}>
        <div className="flex flex-wrap items-center justify-between gap-3 lg:col-start-1">
          <div className="relative w-full min-w-0 sm:w-[396px]">
            <Search className="pointer-events-none absolute left-[16px] top-1/2 size-[18px] -translate-y-1/2 text-[#1E1E1E]" strokeWidth={1.5} />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search Keyword"
              aria-label="Search change requests"
              className="h-[45px] w-full appearance-none border border-[#EEEEEE] bg-white pl-[44px] pr-[16px] text-[14px] text-[#1E1E1E] outline-none placeholder:text-[#A5A5A5] focus:border-primary [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
          <div className="ml-auto flex items-center">
            {canManage ? (
              <Button type="button" variant="primary" onClick={() => setCreateOpen(true)} className="h-[45px] gap-[8px] px-[20px] text-[14px] font-semibold">
                <Plus className="size-[18px]" strokeWidth={1.5} aria-hidden />
                New Change Request
              </Button>
            ) : null}
          </div>
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-[60px]">
          <ChangeFilterPanel
            key={`${applied.currency}|${applied.costFrom}|${applied.costTo}|${applied.type}`}
            status={filter}
            onStatusChange={(next) => {
              setFilter(next);
              setPage(1);
            }}
            applied={applied}
            onApply={(values) => {
              setApplied(values);
              setPage(1);
            }}
            onReset={clearFilters}
            defaultCurrency={project.currency}
          />
        </div>

        <div className="lg:col-start-1">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" />
            </div>
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<ClipboardIcon />}
              // The status filter is applied by the server, so an empty list
              // under one means "nothing matches" — never "none exist".
              title={filtering ? "Nothing matches these filters" : "No change requests yet"}
              description={
                filtering
                  ? "Try a different status, type or cost range."
                  : "Raise one when scope, cost or schedule changes."
              }
              action={filtering ? { label: "Clear filters", onClick: clearFilters } : undefined}
            />
          ) : (
            <>
              <div className="border border-[#EEEEEE] bg-white">
                {pageItems.map((cr) => (
                  <ChangeRow
                    key={cr.id}
                    cr={cr}
                    projectId={project.id}
                    canManage={canManage}
                    onOpen={() => setDetailId(cr.id)}
                    onEdit={() => setEditItem(cr)}
                    onDelete={() => setDeleteId(cr.id)}
                  />
                ))}
              </div>
              <NumberedPagination
                page={currentPage}
                pageSize={PAGE_SIZE}
                total={total}
                noun="Change Requests"
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>

      <UpsertChangeRequestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={project.id}
        mode="create"
        assigneeOptions={assigneeOptions}
        onSubmit={handleCreate}
        isSubmitting={createCr.isPending || runAction.isPending}
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
        title="Delete change request"
        description="This permanently removes the change request and its discussion."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

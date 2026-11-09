import { useUrlState } from "@/hooks/use-url-state";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { useMemo, useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { QueryError } from "@/components/molecules/query-error";
import {
  UpsertRfiDialog,
  type AssigneeOption,
  type UpsertRfiValues,
} from "@/components/molecules/upsert-rfi-dialog";
import { RfiDetailDialog } from "@/components/molecules/rfi-detail-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useCreateRfi, useRfiPage, useUpdateRfi } from "@/hooks/use-rfis";
import type { RfiPageQuery } from "@/api/rfis";
import { NumberedPagination } from "@/components/molecules/numbered-pagination";
import { useParticipants } from "@/hooks/use-participants";
import { useProjectTeam } from "@/hooks/use-team";
import { errorMessage } from "@/lib/api-error";
import { choiceLabel, participantChoices } from "@/lib/assignee-options";
import { canResourceAction } from "@/lib/project-types";
import type { Rfi, RfiCounts, RfiStatus } from "@/lib/project-types";
import { RfiFilterPanel } from "./rfis/rfi-filter-panel";
import { RfiRow } from "./rfis/rfi-row";
import { NO_RFI_FILTERS, type RfiFilterValues } from "./rfis/shared";
import { RfiStatusPills } from "./rfis/rfi-status-pills";

/** "overdue" is a view of the list, not a backend status, so it filters client-side. */
type RfiFilter = RfiStatus | "all" | "overdue";

const STATUS_FILTERS: { value: RfiFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Open", label: "Open" },
  { value: "Answered", label: "Answered" },
  { value: "Closed", label: "Closed" },
];
const OVERDUE_FILTER: { value: RfiFilter; label: string } = { value: "overdue", label: "Overdue" };
const FILTER_VALUES: RfiFilter[] = [...STATUS_FILTERS.map((filter) => filter.value), "overdue"];
const COUNT_KEY: Record<RfiFilter, keyof RfiCounts> = { all: "all", Open: "open", Answered: "answered", Closed: "closed", overdue: "overdue", Draft: "open", InReview: "open", Void: "closed" };
const PAGE_SIZE = 25;
const EMPTY_RFIS: Rfi[] = [];

export default function ProjectRfis() {
  useSetPageTitle("Request for Information (RFI)", "Questions raised against this project and the answers that settle them.");
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "rfis", "manage");
  const canRaise = canResourceAction(access, "rfis", "create");
  const canRespond = canResourceAction(access, "rfis", "respond");

  const [filter, setFilter] = useUrlState<RfiFilter>("status", "all", FILTER_VALUES);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState<RfiFilterValues>(NO_RFI_FILTERS);
  const [page, setPage] = useState(1);
  // The server filters, counts and pages the register (docs/rfis-page-backend.md §2).
  const query: RfiPageQuery = {
    status: filter === "all" || filter === "overdue" ? undefined : [filter],
    overdue: filter === "overdue" || undefined,
    q: search.trim() || undefined,
    priority: applied.priority ? [applied.priority] : undefined,
    dueFrom: applied.dueFrom || undefined,
    dueTo: applied.dueTo || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, isLoading, error, refetch } = useRfiPage(project.id, query);
  const rfis = data?.items ?? EMPTY_RFIS;
  const counts = data?.counts;
  const createRfi = useCreateRfi();
  const updateRfi = useUpdateRfi();

  const { data: participants = [] } = useParticipants(project.id);
  const { data: contacts = [] } = useProjectTeam(project.id);
  const assigneeOptions: AssigneeOption[] = useMemo(
    () => [
      ...participantChoices(participants).map((choice) => ({
        id: choice.userId ?? choice.key,
        name: choiceLabel(choice),
        email: choice.email,
        isUser: choice.userId !== null,
      })),
      ...contacts.map((contact) => ({
        id: contact.id,
        name: contact.company ? `${contact.name} (${contact.company})` : contact.name,
        email: contact.email,
        isUser: false,
      })),
    ],
    [participants, contacts],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Rfi | null>(null);
  const [detailId, setDetailId] = useUrlState<string | null>("rfi", null);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const visible = rfis;
  const total = data?.total ?? 0;
  const overdueCount = counts?.overdue ?? 0;
  // Overdue is a view of the list: offered while something is late, and kept if a link asked for it.
  const statusFilters = (overdueCount > 0 || filter === "overdue" ? [STATUS_FILTERS[0]!, STATUS_FILTERS[1]!, OVERDUE_FILTER, ...STATUS_FILTERS.slice(2)] : STATUS_FILTERS).map((f) => ({
    ...f,
    count: counts ? counts[COUNT_KEY[f.value]] : undefined,
  }));
  const narrowed = search.trim() !== "" || Boolean(applied.priority || applied.dueFrom || applied.dueTo);
  const registerEmpty = (counts?.all ?? 0) === 0 && !narrowed && filter === "all";

  function handleCreate(values: UpsertRfiValues): void {
    createRfi.mutate({ projectId: project.id, ...values }, { onSuccess: () => setCreateOpen(false) });
  }

  function handleEdit(values: UpsertRfiValues): void {
    if (!editing) return;
    updateRfi.mutate(
      { projectId: project.id, rfiId: editing.id, ...values },
      { onSuccess: () => setEditing(null) },
    );
  }

  return (
    <div className="w-full px-4 pb-8 pt-[40px] lg:pl-8 lg:pr-[40px]">
      <div className="grid items-start gap-x-[40px] gap-y-[24px] lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="flex flex-wrap items-center justify-between gap-3 lg:col-start-1">
          <RfiStatusPills items={statusFilters} value={filter} onChange={(v) => { setFilter(v); setPage(1); }} />
          <div className="flex items-center gap-[10px]">
            <Button type="button" variant="ghost" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen} className="h-[36px] border border-[#EEEEEE] px-[16px] text-[14px] lg:hidden">
              Filters
            </Button>
            {canRaise ? (
              <Button type="button" variant="primary" onClick={() => setCreateOpen(true)} className="h-[36px] px-[15px] text-[14px]">
                Raise RFI
              </Button>
            ) : null}
          </div>
        </div>

        <div className={filtersOpen ? "lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-[58px]" : "hidden lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-[58px] lg:block"}>
          <RfiFilterPanel key={`${applied.priority}|${applied.dueFrom}|${applied.dueTo}`} search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} applied={applied} onApply={(v) => { setApplied(v); setPage(1); }} />
        </div>

        <div className="lg:col-start-1">
          {error ? <QueryError error={error} retry={refetch} noun="RFIs" /> : null}
          {!error ? (
            isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner size="md" />
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                icon={<MessageCircleQuestion />}
                title={registerEmpty ? "No RFIs yet" : "No RFIs match this filter"}
                description={
                  registerEmpty
                    ? "Requests for information raised against this project will appear here."
                    : "Choose another status, clear the search, or reset the filter."
                }
                action={
                  filter !== "all" || narrowed
                    ? {
                        label: "Clear filters",
                        onClick: () => {
                          setFilter("all");
                          setSearch("");
                          setApplied(NO_RFI_FILTERS);
                        },
                      }
                    : canRaise
                      ? { label: "Raise the first RFI", onClick: () => setCreateOpen(true) }
                      : undefined
                }
              />
            ) : (
              <>
                <div className="border border-[#EEEEEE] bg-white">
                  {visible.map((rfi) => (
                    <RfiRow key={rfi.id} rfi={rfi} onOpen={setDetailId} />
                  ))}
                </div>
                <NumberedPagination page={Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)))} pageSize={PAGE_SIZE} total={total} noun="RFIs" onPageChange={setPage} />
              </>
            )
          ) : null}
        </div>
      </div>

      <UpsertRfiDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={project.id}
        onSubmit={handleCreate}
        isSubmitting={createRfi.isPending}
        error={createRfi.error ? errorMessage(createRfi.error) : null}
        assigneeOptions={assigneeOptions}
      />

      <UpsertRfiDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        projectId={project.id}
        initial={editing}
        onSubmit={handleEdit}
        isSubmitting={updateRfi.isPending}
        error={updateRfi.error ? errorMessage(updateRfi.error) : null}
        assigneeOptions={assigneeOptions}
      />

      <RfiDetailDialog
        key={detailId}
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
        projectId={project.id}
        rfiId={detailId}
        canManage={canManage}
        canRespond={canRespond}
        onEdit={
          canManage
            ? (rfi) => {
                setDetailId(null);
                setEditing(rfi);
              }
            : undefined
        }
      />
    </div>
  );
}

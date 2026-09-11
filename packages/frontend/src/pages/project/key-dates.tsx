import { useMemo, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { CalendarIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { SearchInput } from "@/components/atoms/search-input";
import { Spinner } from "@/components/atoms/spinner";
import { PageHeader } from "@/components/molecules/page-header";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import { RowActionsMenu } from "@/components/molecules/row-actions-menu";
import { SimpleDropdown, type DropdownOption } from "@/components/molecules/simple-dropdown";
import { DateRangeFilter, formatDateRangeLabel } from "@/components/molecules/date-range-filter";
import {
  UpsertKeyDateDialog,
  type UpsertKeyDateValues,
} from "@/components/molecules/upsert-key-date-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useBuildingScope } from "@/contexts/building-scope-context";
import {
  useCreateKeyDate,
  useDeleteKeyDate,
  useKeyDates,
  useUpdateKeyDate,
} from "@/hooks/use-key-dates";
import { formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { icons } from "@/assets/icons/icons";
import { canResourceAction, type KeyDate, type KeyDateStatus } from "@/lib/project-types";

function fmt(value: string | null): string {
  return formatShortDate(value) || "—";
}

function StatusCell({ status }: { status: KeyDateStatus }) {
  if (status === "Met") return <Badge tone="success" size="sm">Met</Badge>;
  if (status === "Missed") return <Badge tone="danger" size="sm">Missed</Badge>;
  return <Badge tone="info" size="sm">In progress</Badge>;
}

// ── Filter option constants ───────────────────────────────────────────────────

type StatusFilter = "all" | "met" | "in-progress" | "missed";
type DateView = "target" | "actual";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "met", label: "Met" },
  { value: "in-progress", label: "In progress" },
  { value: "missed", label: "Missed" },
];

const DATE_VIEW_OPTIONS: DropdownOption<DateView>[] = [
  { value: "target", label: "Target dates" },
  { value: "actual", label: "Actual dates" },
];

const HEAD_CELL = "px-4 py-3 text-[11px] font-semibold text-black-300 capitalize";

function keyDateFor(kd: KeyDate, view: DateView): string | null {
  return view === "target" ? kd.targetDate : kd.actualDate;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectKeyDates() {
  const { project, access } = useProjectContext();
  const { selectedBuildingId } = useBuildingScope();
  const canManage = Boolean(access && canResourceAction(access, "key-dates", "manage"));
  const { data: keyDates = [], isLoading } = useKeyDates(project.id, selectedBuildingId);
  const createKd = useCreateKeyDate();
  const updateKd = useUpdateKeyDate();
  const deleteKd = useDeleteKeyDate();

  const [createOpen, setCreateOpen] = useState(false);
  const [editKd, setEditKd] = useState<KeyDate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateView, setDateView] = useState<DateView>("target");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const metCount = keyDates.filter((k) => k.status === "Met").length;
  const inProgressCount = keyDates.filter((k) => k.status === "Upcoming").length;
  const missedCount = keyDates.filter((k) => k.status === "Missed").length;

  const dateRangeLabel = useMemo(
    () =>
      formatDateRangeLabel(
        dateFrom,
        dateTo,
        keyDates.flatMap((k) => {
          const d = keyDateFor(k, dateView);
          return d ? [d] : [];
        }),
      ),
    [keyDates, dateView, dateFrom, dateTo],
  );

  const filtered = useMemo(() => {
    return keyDates
      .filter((k) =>
        statusFilter === "all" ||
        (statusFilter === "met" && k.status === "Met") ||
        (statusFilter === "in-progress" && k.status === "Upcoming") ||
        (statusFilter === "missed" && k.status === "Missed"),
      )
      .filter((k) =>
        !search || k.label.toLowerCase().includes(search.toLowerCase()),
      )
      .filter((k) => {
        if (!dateFrom && !dateTo) return true;
        const dateStr = keyDateFor(k, dateView);
        if (!dateStr) return false;
        if (dateFrom && dateStr < dateFrom) return false;
        if (dateTo && dateStr > dateTo) return false;
        return true;
      });
  }, [keyDates, statusFilter, search, dateView, dateFrom, dateTo]);

  function handleCreate(values: UpsertKeyDateValues): void {
    createKd.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  function handleEdit(values: UpsertKeyDateValues): void {
    if (!editKd) return;
    updateKd.mutate(
      { projectId: project.id, keyDateId: editKd.id, ...values },
      { onSuccess: () => setEditKd(null) },
    );
  }

  return (
    <div className="w-full px-4 pt-4 pb-8 sm:px-10 lg:px-6">
      <PageHeader
        title="Key dates"
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4" />
              Add key date
            </Button>
          ) : undefined
        }
      />

      {keyDates.length > 0 ? (
        <section aria-label="Key date summary" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total key dates" icon={icons.calendarSearch} value={keyDates.length} />
          <KpiCard label="Met" icon={icons.verifiedCheck} value={metCount} />
          <KpiCard label="In progress" icon={icons.penSquare} value={inProgressCount} />
          <KpiCard label="Missed" icon={icons.penSquare} value={missedCount} />
        </section>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 rounded-lg border border-[#EDEDED] bg-white lg:max-w-md">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search key dates"
            aria-label="Search key dates"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterTabs items={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} ariaLabel="Filter key dates" />
          <SimpleDropdown options={DATE_VIEW_OPTIONS} value={dateView} onChange={setDateView} ariaLabel="Date view" />
          <DateRangeFilter
            from={dateFrom}
            to={dateTo}
            label={dateRangeLabel}
            onApply={(f, t) => { setDateFrom(f); setDateTo(t); }}
            onClear={() => { setDateFrom(""); setDateTo(""); }}
          />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#F0F0F0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left">
            <thead className="border-b border-[#EDEDED] bg-[#FAFAFA]">
              <tr>
                <th className={cn("w-10", HEAD_CELL)} />
                <th className={HEAD_CELL}>Milestone</th>
                <th className={HEAD_CELL}>Status</th>
                <th className={cn(HEAD_CELL, dateView === "target" && "text-black-500")}>Target date</th>
                <th className={cn(HEAD_CELL, dateView === "actual" && "text-black-500")}>Actual date</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4">
                    <div className="flex justify-center py-10">
                      <Spinner size="md" />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4">
                    <EmptyState
                      variant="inline"
                      icon={<CalendarIcon />}
                      title={keyDates.length === 0 ? "No key dates yet" : "No key dates match your filters"}
                      description={keyDates.length === 0 ? "Add the milestones you want to track." : "Try clearing the search or status filter."}
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((kd, idx) => (
                  <KeyDateRow
                    key={kd.id}
                    kd={kd}
                    index={idx}
                    dateView={dateView}
                    canManage={canManage}
                    onEdit={() => setEditKd(kd)}
                    onDelete={() => setDeleteId(kd.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UpsertKeyDateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createKd.isPending}
        error={(createKd.error as Error | undefined)?.message ?? null}
      />
      <UpsertKeyDateDialog
        open={editKd !== null}
        onOpenChange={(o) => !o && setEditKd(null)}
        mode="edit"
        initial={editKd ?? undefined}
        onSubmit={handleEdit}
        isSubmitting={updateKd.isPending}
        error={(updateKd.error as Error | undefined)?.message ?? null}
      />
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={() => {
          if (deleteId)
            deleteKd.mutate({ projectId: project.id, keyDateId: deleteId });
          setDeleteId(null);
        }}
        title="Delete key date"
        description="This permanently removes the key date."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function KeyDateRow({
  kd,
  index,
  dateView,
  canManage,
  onEdit,
  onDelete,
}: {
  kd: KeyDate;
  index: number;
  dateView: DateView;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="hover:bg-[#FAFAFA]">
      <td className="px-4 py-3">
        <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-[#F6F6F6] text-[12px] font-medium text-[#000000]">
          {index + 1}
        </span>
      </td>
      <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{kd.label}</td>
      <td className="px-4 py-3">
        <StatusCell status={kd.status} />
      </td>
      <td className={cn(
        "whitespace-nowrap px-4 py-3 text-[13px]",
        dateView === "target" ? "font-medium text-gray-900" : "text-gray-400",
      )}>
        {fmt(kd.targetDate)}
      </td>
      <td className={cn(
        "whitespace-nowrap px-4 py-3 text-[13px]",
        dateView === "actual" ? "font-medium text-gray-900" : "text-gray-400",
      )}>
        {fmt(kd.actualDate)}
      </td>
      <td className="px-3 py-3">
        {canManage ? <RowActionsMenu onEdit={onEdit} onDelete={onDelete} /> : null}
      </td>
    </tr>
  );
}

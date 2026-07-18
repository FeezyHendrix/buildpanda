import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { PageHeader } from "@/components/molecules/page-header";
import { KpiCard } from "@/components";
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

function fmtMonthYear(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function StatusCell({ status }: { status: KeyDateStatus }) {
  if (status === "Met") return <Badge tone="success" size="sm">Met</Badge>;
  if (status === "Missed") return <Badge tone="danger" size="sm">Missed</Badge>;
  return <Badge tone="info" size="sm">In progress</Badge>;
}

// ── Generic dropdown used for both status filter and date-view toggle ─────────

type DropdownOption<T extends string> = { value: T; label: string };

function SimpleDropdown<T extends string>({
  options,
  value,
  onChange,
}: {
  options: DropdownOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0]!;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#F0F0F0] bg-white px-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
      >
        {selected.label}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2 text-[13px] hover:bg-[#F6F6F6]",
                opt.value === value ? "font-semibold text-gray-900" : "text-gray-700",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Date-range filter popover ─────────────────────────────────────────────────

function DateRangeFilter({
  from,
  to,
  label,
  onApply,
  onClear,
}: {
  from: string;
  to: string;
  label: string;
  onApply: (from: string, to: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);
  const ref = useRef<HTMLDivElement>(null);
  const hasFilter = Boolean(from || to);

  useEffect(() => {
    setLocalFrom(from);
    setLocalTo(to);
  }, [from, to]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
          hasFilter
            ? "border-primary bg-primary/5 text-primary"
            : "border-[#F0F0F0] bg-white text-gray-700",
        )}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {label}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/5">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-gray-400">
            Date range
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-[12px] text-gray-500">From</label>
              <input
                type="date"
                value={localFrom}
                onChange={(e) => setLocalFrom(e.target.value)}
                className="h-8 w-full rounded-lg border border-[#F0F0F0] px-2 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] text-gray-500">To</label>
              <input
                type="date"
                value={localTo}
                onChange={(e) => setLocalTo(e.target.value)}
                className="h-8 w-full rounded-lg border border-[#F0F0F0] px-2 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            {hasFilter && (
              <button
                type="button"
                onClick={() => { onClear(); setOpen(false); }}
                className="text-[12px] text-gray-500 hover:text-gray-700 hover:underline"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => { onApply(localFrom, localTo); setOpen(false); }}
              className="ml-auto rounded-lg bg-primary px-4 py-1.5 text-[12px] font-medium text-white hover:bg-primary/90"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Row ⋮ menu ────────────────────────────────────────────────────────────────

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        aria-label="Actions"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-gray-700 hover:bg-[#F6F6F6]"
            onClick={() => { setOpen(false); onEdit(); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-red-600 hover:bg-red-50"
            onClick={() => { setOpen(false); onDelete(); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ── Filter option constants ───────────────────────────────────────────────────

type StatusFilter = "all" | "met" | "in-progress" | "missed";
type DateView = "target" | "actual";

const STATUS_OPTIONS: DropdownOption<StatusFilter>[] = [
  { value: "all", label: "All key dates" },
  { value: "met", label: "Met" },
  { value: "in-progress", label: "In progress" },
  { value: "missed", label: "Missed" },
];

const DATE_VIEW_OPTIONS: DropdownOption<DateView>[] = [
  { value: "target", label: "Target dates" },
  { value: "actual", label: "Actual dates" },
];

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

  // Derive date range label from the data when no filter active
  const dateRangeLabel = useMemo(() => {
    if (dateFrom || dateTo) {
      const parts = [dateFrom && fmtMonthYear(dateFrom), dateTo && fmtMonthYear(dateTo)].filter(Boolean);
      return parts.join(" – ");
    }
    const dates = keyDates
      .map((k) => dateView === "target" ? k.targetDate : k.actualDate)
      .filter(Boolean) as string[];
    if (dates.length === 0) return "Date range";
    const sorted = [...dates].sort();
    const first = fmtMonthYear(sorted[0]);
    const last = fmtMonthYear(sorted[sorted.length - 1]);
    return first === last ? first : `${first} – ${last}`;
  }, [keyDates, dateView, dateFrom, dateTo]);

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
        const dateStr = dateView === "target" ? k.targetDate : k.actualDate;
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
    <div className="w-full px-4 py-8 sm:px-10 lg:px-6">
      <Breadcrumbs
        items={[
          { label: "Schedule", to: `/project/${project.id}/schedule` },
          { label: "Key Dates" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Key Dates"
        description="The milestone dates that matter: target vs actual, so slippage is visible."
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4" />
              Add Key Date
            </Button>
          ) : undefined
        }
      />

      {/* Stats row — KpiCards matching build stages pattern */}
      {keyDates.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <KpiCard
            title="Total Key Dates"
            icon={icons.calendarSearch}
            value={keyDates.length}
            className="rounded-tl-[16px] rounded-bl-[16px] rounded-tr-[1px] rounded-br-[1px] lg:col-span-3"
          />
          <KpiCard
            title="Met"
            icon={icons.verifiedCheck}
            value={metCount}
            className="rounded-[1px] lg:col-span-3"
          />
          <KpiCard
            title="In Progress"
            icon={icons.penSquare}
            value={inProgressCount}
            className="rounded-[1px] lg:col-span-3"
          />
          <KpiCard
            title="Missed"
            icon={icons.penSquare}
            value={missedCount}
            className="rounded-tr-[16px] rounded-br-[16px] rounded-tl-[1px] rounded-bl-[1px] lg:col-span-3"
          />
        </div>
      )}

      {/* Search + filters row */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative max-w-xs flex-1">
          <svg
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Key Dates"
            className="h-9 w-full rounded-lg bg-[#F8F8F8] pl-9 pr-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10 lg:text-sm"
          />
        </div>

        {/* Right-side filters */}
        <div className="flex flex-wrap items-center gap-2">
          <SimpleDropdown
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <SimpleDropdown
            options={DATE_VIEW_OPTIONS}
            value={dateView}
            onChange={setDateView}
          />
          <DateRangeFilter
            from={dateFrom}
            to={dateTo}
            label={dateRangeLabel}
            onApply={(f, t) => { setDateFrom(f); setDateTo(t); }}
            onClear={() => { setDateFrom(""); setDateTo(""); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#F0F0F0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left">
            <thead className="border-b border-[#EDEDED] bg-[#FAFAFA]">
              <tr>
                <th className="w-10 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400"/>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Milestones
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Status
                </th>
                <th className={cn(
                  "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider",
                  dateView === "target" ? "text-gray-700" : "text-gray-400",
                )}>
                  Target date
                </th>
                <th className={cn(
                  "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider",
                  dateView === "actual" ? "text-gray-700" : "text-gray-400",
                )}>
                  Actual date
                </th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                    {keyDates.length === 0
                      ? "No key dates yet. Add the milestones you want to track."
                      : "No key dates match your filters."}
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
        {canManage && <RowMenu onEdit={onEdit} onDelete={onDelete} />}
      </td>
    </tr>
  );
}

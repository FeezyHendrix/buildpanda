import { useMemo, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { Select } from "@/components/atoms/select";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { MetricCard } from "@/components/molecules/metric-card";
import {
  UpsertKeyDateDialog,
  type UpsertKeyDateValues,
} from "@/components/molecules/upsert-key-date-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { useBuildingScope } from "@/contexts/building-scope-context";
import {
  useCreateKeyDate,
  useDeleteKeyDate,
  useKeyDates,
  useUpdateKeyDate,
} from "@/hooks/use-key-dates";
import { formatShortDate } from "@/lib/formatters";
import { canResourceAction, type KeyDate, type KeyDateStatus } from "@/lib/project-types";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { TextInput } from "@/components/atoms/text-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu";

function fmt(value: string | null): string {
  return formatShortDate(value) || "—";
}

function StatusBadge({ status }: { status: KeyDateStatus }) {
  if (status === "Met")
    return (
      <Badge tone="success" size="md">
        Met
      </Badge>
    );
  if (status === "Missed")
    return (
      <Badge tone="danger" size="md">
        Missed
      </Badge>
    );
  if (status === "Upcoming")
    return (
      <Badge tone="info" size="md">
        In progress
      </Badge>
    );
  return (
    <Badge tone="neutral" variant="outline" size="md">
      Not Started
    </Badge>
  );
}

// Map UI filter to backend status
type StatusFilter = "all" | "upcoming" | "completed" | "in-progress" | "missed" | "not-started";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Key dates" },
  { value: "completed", label: "Completed" },
  { value: "in-progress", label: "In Progress" },
  { value: "missed", label: "Missed" },
  { value: "upcoming", label: "Upcoming" },
  { value: "not-started", label: "Not Started" },
];

export default function ProjectKeyDates() {
  useSetPageTitle("Key dates", "The milestone dates that matter: target vs actual, so slippage is visible.");

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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // KPI counts - map to screenshot: Upcoming, Completed (Met), In progress (Upcoming), Missed
  const upcomingCount = keyDates.filter((k) => k.status === "Upcoming").length;
  const completedCount = keyDates.filter((k) => k.status === "Met").length;
  const inProgressCount = keyDates.filter((k) => k.status === "Upcoming").length;
  const missedCount = keyDates.filter((k) => k.status === "Missed").length;

  const filtered = useMemo(() => {
    return keyDates
      .filter((k) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "completed") return k.status === "Met";
        if (statusFilter === "missed") return k.status === "Missed";
        if (statusFilter === "upcoming" || statusFilter === "in-progress") return k.status === "Upcoming";
        if (statusFilter === "not-started") return !k.status || k.status === "Upcoming"; // fallback
        return true;
      })
      .filter((k) => !search || k.label.toLowerCase().includes(search.toLowerCase()))
      .filter((k) => {
        if (!fromDate && !toDate) return true;
        const d = k.targetDate;
        if (!d) return false;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      });
  }, [keyDates, statusFilter, search, fromDate, toDate]);

  // Pagination mock - showing 1 to 10 of 20
  const total = filtered.length;
  const pageSize = 10;
  const page = 1;
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  function handleCreate(values: UpsertKeyDateValues): void {
    createKd.mutate({ projectId: project.id, ...values }, { onSuccess: () => setCreateOpen(false) });
  }
  function handleEdit(values: UpsertKeyDateValues): void {
    if (!editKd) return;
    updateKd.mutate({ projectId: project.id, keyDateId: editKd.id, ...values }, { onSuccess: () => setEditKd(null) });
  }

  return (
    <div className="w-full px-4 lg:px-8 py-6">
      {/* Actions bar: Add button at top right like Figma */}
      {canManage && (
        <div className="mt-4 flex justify-end mb-6">
          <Button
            variant="primary"
            size="lg"
            onClick={() => setCreateOpen(true)}
            className="gap-1.5"
          >
            <PlusIcon className="size-6" />
            Add Key Date
          </Button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Upcoming" value={upcomingCount} helperText="Milestones ahead" />
        <MetricCard label="Completed" value={completedCount} helperText="Milestones Completed" />
        <MetricCard label="In progress" value={inProgressCount} helperText="Milestones in progress" />
        <MetricCard label="Missed" value={missedCount} helperText="Milestones delayed" />
      </div>

      {/* Search + filters */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-[320px]">
          <ReactSVG
            src={icons2.search}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 shrink-0 [&_svg]:size-[18px]"
          />
          <TextInput
            type="search"
            placeholder="Search key dates..."
            value={search}
            onChange={setSearch}
            aria-label="Search key dates"
            className="h-10 w-full indent-8"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(v) => v && setStatusFilter(v as StatusFilter)}
            placeholder="All Key dates"
            className="w-[160px] h-10"
          />

          {/* Date range */}
          <div className="flex items-center gap-2">
            <div
              className="relative"
              onClick={(e) =>
                (
                  e.currentTarget.querySelector(
                    "input",
                  ) as HTMLInputElement | null
                )?.showPicker?.()
              }
            >
              <TextInput
                type="date"
                placeholder="DD/MM/YY"
                value={fromDate}
                onChange={setFromDate}
                aria-label="From date"
                className="h-10 w-[140px] cursor-pointer pr-9 [&::-webkit-calendar-picker-indicator]:hidden"
                onClick={(e) =>
                  (e.currentTarget as HTMLInputElement).showPicker?.()
                }
              />
              <ReactSVG
                src={icons2.calendar}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 [&_svg]:size-[16px]"
              />
            </div>
            <span className="text-xs text-[#9CA3AF]">—</span>
            <div
              className="relative"
              onClick={(e) =>
                (
                  e.currentTarget.querySelector(
                    "input",
                  ) as HTMLInputElement | null
                )?.showPicker?.()
              }
            >
              <TextInput
                type="date"
                placeholder="DD/MM/YY"
                value={toDate}
                onChange={setToDate}
                aria-label="To date"
                className="h-10 w-[140px] cursor-pointer pr-9 [&::-webkit-calendar-picker-indicator]:hidden"
                onClick={(e) =>
                  (e.currentTarget as HTMLInputElement).showPicker?.()
                }
              />
              <ReactSVG
                src={icons2.calendar}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 [&_svg]:size-[16px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="mt-4 flex justify-center border-[0.5px] border-[#EBEBEB] bg-white py-16">
          <Spinner size="md" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-20 lg:mt-28 flex flex-col items-center justify-center py-16">
          <EmptyState
            title={
              keyDates.length === 0
                ? "No key dates yet"
                : "No matching key dates"
            }
            description={
              keyDates.length === 0
                ? "Add the milestones you want to track — target vs actual dates will be visible here."
                : "No key dates match your search or filters."
            }
            action={
              canManage && keyDates.length === 0 ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setCreateOpen(true)}
                >
                  <PlusIcon className="size-4" />
                  Add Key Date
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden border-[0.5px] border-[#EBEBEB] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed text-left border-[0.5px] border-border">
              <colgroup>
                <col className="w-10" />
                <col className="w-[22%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-20" />
              </colgroup>
              <thead className="bg-grey-50">
                <tr className="border-b-[0.5px] border-border text-caption-m text-[#606060] font-semibold">
                  <th className="px-2 py-3 text-center text-caption-l font-semibold text-[#606060]">
                    #
                  </th>
                  <th className="px-3 py-3 text-caption-l font-semibold text-[#606060]">
                    Milestones
                  </th>
                  <th className="px-3 py-3 text-caption-l font-semibold text-[#606060]">
                    Status
                  </th>
                  <th className="px-3 py-3 text-caption-l font-semibold text-[#606060]">
                    Target date
                  </th>
                  <th className="px-3 py-3 text-caption-l font-semibold text-[#606060]">
                    Actual date
                  </th>
                  <th className="px-3 py-3 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0] bg-white">
                {filtered.map((kd) => (
                  <tr key={kd.id} className="group hover:bg-[#FAFAFA]">
                    <td className="px-2 py-3 text-center">
                      <span className="inline-flex size-5 items-center justify-center text-[11px] text-[#9CA3AF]">
                        <ReactSVG src={icons2.reorder} />
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="block truncate text-sm font-medium text-[#111827]">
                        {kd.label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={kd.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm text-[#6B7280]">
                      {fmt(kd.targetDate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm text-[#6B7280]">
                      {fmt(kd.actualDate)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end">
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button
                                  type="button"
                                  className="flex size-7 items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111827]"
                                  aria-label="Row actions"
                                >
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                                    <circle cx="7" cy="2.5" r="1.3" />
                                    <circle cx="7" cy="7" r="1.3" />
                                    <circle cx="7" cy="11.5" r="1.3" />
                                  </svg>
                                </button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-[160px]">
                              <DropdownMenuItem onSelect={() => setEditKd(kd)}>
                                <ReactSVG src={icons2.edit} className="[&_svg]:size-4 shrink-0" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem tone="danger" onSelect={() => setDeleteId(kd.id)}>
                                <ReactSVG src={icons2.delete} className="[&_svg]:size-4 shrink-0" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="mt-3 text-xs text-[#9CA3AF]">
          Showing {showingFrom} to {showingTo} of {total} Key dates
        </p>
      )}

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


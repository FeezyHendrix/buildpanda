import { useMemo, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { CalendarIcon } from "@/components/atoms/project-nav-icons";
import { SearchInput } from "@/components/atoms/search-input";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { SimpleDropdown, type DropdownOption } from "@/components/molecules/simple-dropdown";
import { DateRangeFilter, formatDateRangeLabel } from "@/components/molecules/date-range-filter";
import { LOOK_AHEAD_STATUSES, type LookAhead, type LookAheadStatus } from "@/lib/project-types";
import { formatLookAheadDate, LOOK_AHEAD_STATUS_META } from "./look-ahead-helpers";

type StatusFilter = LookAheadStatus | "all";
type SortMode = "start-desc" | "start-asc" | "end-desc" | "status";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...LOOK_AHEAD_STATUSES.map((status) => ({ value: status, label: LOOK_AHEAD_STATUS_META[status].label })),
];

const SORT_OPTIONS: DropdownOption<SortMode>[] = [
  { value: "start-desc", label: "Newest start" },
  { value: "start-asc", label: "Oldest start" },
  { value: "end-desc", label: "Latest end" },
  { value: "status", label: "Status" },
];

function compareRows(sort: SortMode, a: LookAhead, b: LookAhead): number {
  if (sort === "start-asc") return a.startDate.localeCompare(b.startDate);
  if (sort === "end-desc") return b.endDate.localeCompare(a.endDate);
  if (sort === "status") return a.status.localeCompare(b.status) || b.startDate.localeCompare(a.startDate);
  return b.startDate.localeCompare(a.startDate);
}

interface LookAheadsTableProps {
  lookAheads: LookAhead[];
  canManage: boolean;
  activityCoverage: ReadonlyMap<string, boolean>;
  onCreate: () => void;
  onView: (lookAhead: LookAhead) => void;
  onEdit: (lookAhead: LookAhead) => void;
  onDelete: (lookAhead: LookAhead) => void;
}

export function LookAheadsTable({
  lookAheads,
  canManage,
  activityCoverage,
  onCreate,
  onView,
  onEdit,
  onDelete,
}: LookAheadsTableProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<SortMode>("start-desc");

  const dateRangeLabel = useMemo(
    () => formatDateRangeLabel(from, to, lookAheads.map((item) => item.startDate)),
    [from, to, lookAheads],
  );

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = lookAheads
      .filter((item) => status === "all" || item.status === status)
      .filter((item) => !from || item.endDate >= from)
      .filter((item) => !to || item.startDate <= to)
      .filter((item) => {
        if (!term) return true;
        return [item.name, item.description ?? "", ...item.activities.map((activity) => activity.name)]
          .join(" ")
          .toLowerCase()
          .includes(term);
      });
    return [...filtered].sort((a, b) => compareRows(sort, a, b));
  }, [from, lookAheads, query, sort, status, to]);

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 rounded-lg border border-[#EDEDED] bg-white lg:max-w-md">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search look aheads"
            aria-label="Search look aheads"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterTabs items={STATUS_TABS} value={status} onChange={setStatus} ariaLabel="Filter look aheads" />
          <DateRangeFilter
            from={from}
            to={to}
            label={dateRangeLabel}
            onApply={(f, t) => { setFrom(f); setTo(t); }}
            onClear={() => { setFrom(""); setTo(""); }}
          />
          <SimpleDropdown options={SORT_OPTIONS} value={sort} onChange={setSort} ariaLabel="Sort look aheads" />
        </div>
      </div>

      <Card padding="none" className="mt-4 overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<CalendarIcon />}
            title={lookAheads.length === 0 ? "No look aheads yet" : "No look aheads match these filters"}
            description={lookAheads.length === 0 ? "Plan the next few weeks of work as a look ahead." : "Adjust the filters or add a new look ahead."}
            action={canManage ? { label: "Add look ahead", onClick: onCreate } : undefined}
          />
        ) : (
          <Table className="min-w-[980px]">
            <TableHead>
              <tr>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Manpower</TableHeaderCell>
                <TableHeaderCell>Start date</TableHeaderCell>
                <TableHeaderCell>End date</TableHeaderCell>
                <TableHeaderCell>Activities</TableHeaderCell>
                <TableHeaderCell>Materials</TableHeaderCell>
                <TableHeaderCell align="right">Actions</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {rows.map((lookAhead) => (
                <LookAheadRow
                  key={lookAhead.id}
                  lookAhead={lookAhead}
                  canManage={canManage}
                  activityCoverage={activityCoverage}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}

function LookAheadRow({
  lookAhead,
  canManage,
  activityCoverage,
  onView,
  onEdit,
  onDelete,
}: Omit<LookAheadsTableProps, "lookAheads" | "onCreate"> & { lookAhead: LookAhead }) {
  const status = LOOK_AHEAD_STATUS_META[lookAhead.status];
  const material = materialState(lookAhead, activityCoverage);

  return (
    <TableRow className="bg-white align-middle transition-colors hover:bg-[#FAFAFA]">
      <TableCell className="max-w-[260px]">
        <button type="button" onClick={() => onView(lookAhead)} className="text-left">
          <span className="block truncate font-semibold text-gray-900 hover:text-primary-700">{lookAhead.name}</span>
          {lookAhead.description ? <span className="mt-1 line-clamp-1 text-xs text-gray-500">{lookAhead.description}</span> : null}
        </button>
      </TableCell>
      <TableCell><Badge tone={status.tone} size="sm">{status.label}</Badge></TableCell>
      <TableCell className="tabular-nums">{lookAhead.totalWorkers ?? "-"}</TableCell>
      <TableCell className="whitespace-nowrap">{formatLookAheadDate(lookAhead.startDate)}</TableCell>
      <TableCell className="whitespace-nowrap">{formatLookAheadDate(lookAhead.endDate)}</TableCell>
      <TableCell>{lookAhead.activities.length}</TableCell>
      <TableCell><Badge tone={material.tone} size="sm">{material.label}</Badge></TableCell>
      <TableCell>
        <div className="flex justify-end gap-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={() => onView(lookAhead)}>View</Button>
          {canManage ? <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(lookAhead)}>Edit</Button> : null}
          {canManage ? <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => onDelete(lookAhead)}>Delete</Button> : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function materialState(lookAhead: LookAhead, activityCoverage: ReadonlyMap<string, boolean>): { label: string; tone: "neutral" | "success" | "danger" | "warning" } {
  if (lookAhead.activities.length === 0) return { label: "No activities", tone: "neutral" };
  const tracked = lookAhead.activities.flatMap((activity) => {
    const covered = activityCoverage.get(activity.activityId);
    return covered === undefined ? [] : [covered];
  });
  if (tracked.length === 0) return { label: "Not tracked", tone: "warning" };
  const gaps = tracked.filter((covered) => !covered).length;
  if (gaps > 0) return { label: `${gaps} gap${gaps === 1 ? "" : "s"}`, tone: "danger" };
  return { label: "Covered", tone: "success" };
}

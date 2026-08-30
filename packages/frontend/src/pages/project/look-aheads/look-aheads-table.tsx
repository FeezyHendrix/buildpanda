import { useMemo, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { EmptyState } from "@/components/molecules/empty-state";
import { CalendarIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import type { LookAhead, LookAheadStatus } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { formatLookAheadDate, LOOK_AHEAD_STATUS_META, STATUS_FILTERS } from "./look-ahead-helpers";

type SortMode = "start-desc" | "start-asc" | "end-desc" | "status";

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
  const [status, setStatus] = useState<LookAheadStatus | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<SortMode>("start-desc");

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
      })
    return [...filtered].sort((a, b) => {
        if (sort === "start-asc") return a.startDate.localeCompare(b.startDate);
        if (sort === "end-desc") return b.endDate.localeCompare(a.endDate);
        if (sort === "status") return a.status.localeCompare(b.status) || b.startDate.localeCompare(a.startDate);
        return b.startDate.localeCompare(a.startDate);
      });
  }, [from, lookAheads, query, sort, status, to]);

  return (
    <Card padding="none" className="overflow-hidden rounded-[18px] border border-[#EDEDED] bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-[#EDEDED] bg-[#FAFAFA] p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Look aheads</h2>
          <p className="mt-1 text-xs text-gray-500">Search, filter, and manage short-term execution windows.</p>
        </div>
        {canManage && (
          <Button type="button" size="sm" onClick={onCreate}>
            <PlusIcon className="size-4" />
            Add Look Ahead
          </Button>
        )}
      </div>

      <div className="grid gap-3 border-b border-[#EDEDED] p-4 lg:grid-cols-[minmax(240px,1fr)_160px_150px_150px_160px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, description, activity"
          className={filterInputClass}
        />
        <select value={status} onChange={(event) => setStatus(event.target.value as LookAheadStatus | "all")} className={filterInputClass}>
          {STATUS_FILTERS.map((option) => (
            <option key={option} value={option}>{option === "all" ? "All statuses" : LOOK_AHEAD_STATUS_META[option].label}</option>
          ))}
        </select>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={filterInputClass} aria-label="From date" />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={filterInputClass} aria-label="To date" />
        <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className={filterInputClass}>
          <option value="start-desc">Newest start</option>
          <option value="start-asc">Oldest start</option>
          <option value="end-desc">Latest end</option>
          <option value="status">Status</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="p-8">
          <EmptyState
            icon={<CalendarIcon className="size-8 text-gray-300" />}
            title="No look aheads match"
            description="Adjust the filters or create a new look-ahead period."
            action={canManage ? <Button size="sm" onClick={onCreate}>Create look ahead</Button> : undefined}
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-white text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              <tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Manpower</Th>
                <Th>Start Date</Th>
                <Th>End Date</Th>
                <Th>Activities</Th>
                <Th>Materials</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEDED]">
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
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const filterInputClass = "h-10 rounded-lg border border-[#EDEDED] bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100";

function Th({ children, align = "left" }: { children: string; align?: "left" | "right" }) {
  return <th className={cn("px-4 py-3", align === "right" && "text-right")}>{children}</th>;
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
    <tr className="bg-white align-middle text-gray-700 transition-colors hover:bg-[#FAFAFA]">
      <td className="max-w-[260px] px-4 py-4">
        <button type="button" onClick={() => onView(lookAhead)} className="text-left">
          <span className="block truncate font-semibold text-gray-900 hover:text-primary-700">{lookAhead.name}</span>
          {lookAhead.description && <span className="mt-1 line-clamp-1 text-xs text-gray-500">{lookAhead.description}</span>}
        </button>
      </td>
      <td className="px-4 py-4"><Badge tone={status.tone} size="sm">{status.label}</Badge></td>
      <td className="px-4 py-4 tabular-nums">{lookAhead.totalWorkers ?? "-"}</td>
      <td className="px-4 py-4 whitespace-nowrap">{formatLookAheadDate(lookAhead.startDate)}</td>
      <td className="px-4 py-4 whitespace-nowrap">{formatLookAheadDate(lookAhead.endDate)}</td>
      <td className="px-4 py-4">{lookAhead.activities.length}</td>
      <td className="px-4 py-4"><Badge tone={material.tone} size="sm">{material.label}</Badge></td>
      <td className="px-4 py-4">
        <div className="flex justify-end gap-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={() => onView(lookAhead)}>View</Button>
          {canManage && <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(lookAhead)}>Edit</Button>}
          {canManage && <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => onDelete(lookAhead)}>Delete</Button>}
        </div>
      </td>
    </tr>
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

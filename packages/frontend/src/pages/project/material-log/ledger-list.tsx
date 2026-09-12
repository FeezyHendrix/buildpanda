import { useMemo, useState } from "react";
import { Card } from "@/components/atoms/card";
import { EmptyState } from "@/components/molecules/empty-state";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { formatLongDate } from "@/lib/formatters";
import type { LedgerEntry } from "@/lib/project-types";
import { StackIcon } from "./icons";
import { LedgerRow } from "./ledger-row";
import {
  LEDGER_FILTERS,
  matchesLedgerFilter,
  type LedgerFilter,
} from "./shared";

interface DayGroup {
  key: string;
  label: string;
  entries: LedgerEntry[];
}

function dayLabel(iso: string, now: Date): string {
  const then = new Date(iso);
  const days = Math.round(
    (new Date(now.toDateString()).getTime() -
      new Date(then.toDateString()).getTime()) /
      86_400_000,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return formatLongDate(then);
}

/**
 * Groups consecutive entries by the day they occurred without reordering them —
 * the ledger's own sequence is part of the record, so we never sort it here.
 */
function groupByDay(entries: LedgerEntry[], now: Date): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const key = new Date(entry.occurredAt).toDateString();
    const current = groups[groups.length - 1];
    if (current && current.key === key) {
      current.entries.push(entry);
      continue;
    }
    groups.push({ key, label: dayLabel(entry.occurredAt, now), entries: [entry] });
  }
  return groups;
}

function entryCount(count: number): string {
  return `${count} ${count === 1 ? "entry" : "entries"}`;
}

export function LedgerList({
  entries,
  canManage,
  onVoid,
  onApprove,
  approvingId,
}: {
  entries: LedgerEntry[];
  canManage: boolean;
  onVoid: (entry: LedgerEntry) => void;
  onApprove: (entry: LedgerEntry) => void;
  approvingId?: string | null;
}) {
  const [filter, setFilter] = useState<LedgerFilter>("all");

  const visible = useMemo(
    () => entries.filter((entry) => matchesLedgerFilter(entry, filter)),
    [entries, filter],
  );
  const groups = useMemo(() => groupByDay(visible, new Date()), [visible]);

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line-hair p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-black-500">Ledger</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Append-only record of every movement — {entryCount(visible.length)}
            {filter === "all" ? "" : ` of ${entries.length}`} shown.
          </p>
        </div>
        <FilterTabs
          items={LEDGER_FILTERS}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter ledger entries"
          className="shrink-0"
        />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<StackIcon />}
          title="No ledger entries yet"
          description="Every delivery received and every bag used gets recorded here, with who logged it and when."
          className="px-6"
        />
      ) : visible.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<StackIcon />}
          title="No entries match this filter"
          description="Nothing in the ledger falls under this view yet."
          action={{ label: "Show all entries", onClick: () => setFilter("all") }}
          className="px-6"
        />
      ) : (
        groups.map((group) => (
          <section key={group.key}>
            <div className="flex items-center justify-between border-b border-line-hair bg-surface-alt px-4 py-2 sm:px-5">
              <h3 className="text-xs font-medium uppercase text-ink-muted">
                {group.label}
              </h3>
              <p className="text-xs text-gray-400">
                {entryCount(group.entries.length)}
              </p>
            </div>
            <div className="divide-y divide-line-hair">
              {group.entries.map((entry) => (
                <LedgerRow
                  key={entry.id}
                  entry={entry}
                  canManage={canManage}
                  onVoid={() => onVoid(entry)}
                  onApprove={() => onApprove(entry)}
                  approving={approvingId === entry.id}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </Card>
  );
}

LedgerList.displayName = "LedgerList";

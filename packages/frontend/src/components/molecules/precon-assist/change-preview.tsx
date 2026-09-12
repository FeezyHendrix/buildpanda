import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import type { AssistChange, ChangeSet } from "@/api/precon-assist";
import { cn } from "@/lib/utils";

interface Props {
  changeSet: ChangeSet;
  onApply: () => void;
  onDiscard: () => void;
  onUndo: () => void;
  applying: boolean;
  undoing: boolean;
  discarding: boolean;
}

const OP_META: Record<AssistChange["op"], { label: string; tone: BadgeTone }> = {
  update: { label: "changed", tone: "info" },
  create: { label: "added", tone: "success" },
  delete: { label: "removed", tone: "danger" },
};

const FIELD_LABEL: Record<string, string> = {
  qty: "Qty",
  rate: "Rate",
  unit: "Unit",
  description: "Description",
  status: "Status",
  name: "Name",
  durationDays: "Duration (days)",
  isMilestone: "Milestone",
  basis: "Basis",
  predecessors: "Predecessors",
  outlineLevel: "Level",
  sort: "Order",
  billId: "Bill",
  elementGroup: "Element",
  code: "Code",
  rowType: "Type",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.length === 0 ? "none" : `${value.length} link${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replace(/_/g, " ");
}

function FieldDiff({ change }: { change: AssistChange }) {
  const source = change.op === "delete" ? (change.before ?? {}) : change.after;
  // an update lists only the fields that actually move; a create or delete
  // shows the whole row
  const keys = Object.keys(source).filter(
    (k) =>
      (k !== "billId" || change.op === "create") &&
      (change.op !== "update" || JSON.stringify(change.before?.[k] ?? null) !== JSON.stringify(change.after[k] ?? null)),
  );
  return (
    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {keys.map((key) => (
        <div key={key} className="contents">
          <dt className="text-gray-400">{FIELD_LABEL[key] ?? key}</dt>
          <dd className="font-mono tabular-nums text-gray-700">
            {change.op === "update" ? (
              <>
                <span className="text-gray-400 line-through">{formatValue(change.before?.[key])}</span>
                <span className="mx-1 text-gray-300">→</span>
                <span className="text-gray-900">{formatValue(change.after[key])}</span>
              </>
            ) : (
              formatValue(source[key])
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
FieldDiff.displayName = "FieldDiff";

function ChangeRow({ change, outcome }: { change: AssistChange; outcome?: { outcome: "applied" | "skipped"; reason?: string } }) {
  const meta = OP_META[change.op];
  return (
    <li className={cn("py-2.5", outcome?.outcome === "skipped" && "opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm text-gray-900">{change.label ?? change.id ?? change.entity}</p>
        <Badge tone={outcome?.outcome === "skipped" ? "warning" : meta.tone}>
          {outcome?.outcome === "skipped" ? "skipped" : meta.label}
        </Badge>
      </div>
      <FieldDiff change={change} />
      {outcome?.reason ? <p className="mt-1 text-xs text-amber-700">{outcome.reason}</p> : null}
    </li>
  );
}
ChangeRow.displayName = "ChangeRow";

export function ChangePreview({ changeSet, onApply, onDiscard, onUndo, applying, undoing, discarding }: Props) {
  const counts = changeSet.changes.reduce(
    (acc, c) => ({ ...acc, [c.op]: acc[c.op] + 1 }),
    { update: 0, create: 0, delete: 0 } as Record<AssistChange["op"], number>,
  );
  const total = changeSet.changes.length;
  const outcomes = changeSet.appliedResult?.changes ?? [];

  return (
    <section className="rounded-lg border border-line bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-line-hair px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">
          {changeSet.status === "proposed" ? "Preview" : changeSet.status === "applied" ? "Applied" : changeSet.status === "undone" ? "Undone" : "Discarded"}
          {" · "}
          {total} change{total === 1 ? "" : "s"}
        </p>
        {counts.update > 0 ? <Badge tone="info">{counts.update} changed</Badge> : null}
        {counts.create > 0 ? <Badge tone="success">{counts.create} added</Badge> : null}
        {counts.delete > 0 ? <Badge tone="danger">{counts.delete} removed</Badge> : null}
        {changeSet.status === "proposed" ? <Badge tone="warning" className="ml-auto">not applied</Badge> : null}
      </header>
      {total === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500">Panda AI proposed no changes. Read the plan for why, then change the request.</p>
      ) : (
        <ul className="max-h-[40vh] divide-y divide-line-hair overflow-y-auto px-4">
          {changeSet.changes.map((change, index) => (
            <ChangeRow key={`${change.entity}-${change.id ?? index}`} change={change} outcome={outcomes[index]} />
          ))}
        </ul>
      )}
      <footer className="flex flex-col gap-2 border-t border-line-hair px-4 py-3 text-xs text-gray-500">
        {changeSet.status === "proposed" ? (
          <>
            <p>Changed lines go back to Needs review. Applied changes are logged as made via a Panda AI prompt, and one click undoes the set.</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" loading={discarding} onClick={onDiscard}>
                Discard
              </Button>
              <Button size="sm" loading={applying} disabled={total === 0} onClick={onApply}>
                Apply {total} change{total === 1 ? "" : "s"}
              </Button>
            </div>
          </>
        ) : changeSet.status === "applied" ? (
          <div className="flex items-center justify-between gap-2">
            <p>
              {changeSet.appliedResult?.applied ?? 0} applied
              {changeSet.appliedResult?.skipped ? `, ${changeSet.appliedResult.skipped} skipped` : ""}.
            </p>
            <Button size="sm" variant="secondary" loading={undoing} onClick={onUndo}>
              Undo
            </Button>
          </div>
        ) : null}
      </footer>
    </section>
  );
}
ChangePreview.displayName = "ChangePreview";

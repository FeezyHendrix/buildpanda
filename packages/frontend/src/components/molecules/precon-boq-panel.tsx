import { useMemo, useState } from "react";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import { useCreatePreconBill } from "@/hooks/use-precon";
import { PreconRowComposer } from "@/components/molecules/precon-row-composer";
import { LineDetail } from "@/components/molecules/precon-session/line-detail";
import { NeedsAttentionQueue } from "@/components/molecules/precon-session/needs-attention-queue";
import { confidenceReasonLabel } from "@/lib/precon-meta";
import type { PreconBoqRow, PreconRowStatus, PreconSnapshot } from "@/api/precon";

const STATUS_META: Record<PreconRowStatus, { label: string; mark: string }> = {
  ai_generated: { label: "AI draft", mark: "◇" },
  needs_review: { label: "Needs review", mark: "▲" },
  verified: { label: "Verified", mark: "✓" },
  rejected: { label: "Rejected", mark: "✕" },
};

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

interface PanelProps {
  sessionId: string;
  snapshot: PreconSnapshot;
  selectedRowId: string | null;
  onSelectRow: (rowId: string | null, sheetId?: string | null) => void;
}

function RowStatusDot({ status }: { status: PreconRowStatus | null }) {
  if (!status) return null;
  const meta = STATUS_META[status];
  return (
    <span
      key={status}
      title={meta.label}
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] leading-none",
        status === "verified" && "bg-emerald-100 text-emerald-700 animate-pop motion-reduce:animate-none",
        status === "needs_review" && "bg-amber-100 text-amber-700",
        status === "ai_generated" && "bg-primary-100 text-primary-700",
        status === "rejected" && "bg-red-100 text-red-600 animate-pop motion-reduce:animate-none",
      )}
    >
      {meta.mark}
    </span>
  );
}
RowStatusDot.displayName = "RowStatusDot";

function BillRow({
  row,
  selected,
  sessionId,
  onSelect,
  onConflict,
}: {
  row: PreconBoqRow;
  selected: boolean;
  sessionId: string;
  onSelect: () => void;
  onConflict: (message: string) => void;
}) {
  if (row.rowType === "heading" || row.rowType === "work_section") {
    return (
      <li className={cn("px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-gray-500", row.rowType === "work_section" && "text-gray-400")}>
        {row.description}
      </li>
    );
  }
  if (row.rowType === "spec_note") {
    return <li className="px-3 py-1 text-[11px] italic text-gray-400">{row.description}</li>;
  }
  const reason = row.status !== "verified" ? confidenceReasonLabel(row.confidenceReason) : null;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        title={reason ?? row.provenance ?? undefined}
        className={cn(
          "flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-xs hover:bg-gray-50",
          selected ? "border-primary-600 bg-primary-50/50" : "border-transparent",
          row.status === "rejected" && "opacity-50",
        )}
      >
        <RowStatusDot status={row.status} />
        <span className="w-14 shrink-0 font-mono text-[10px] text-gray-400">{row.code}</span>
        <span className={cn("min-w-0 flex-1 truncate text-gray-800", row.status === "rejected" && "line-through")}>{row.description}</span>
        {reason ? <span className="hidden shrink-0 text-[10px] text-amber-700 xl:inline">{reason}</span> : null}
        <span className="shrink-0 tabular-nums text-gray-600">
          {row.qty ?? "—"} {row.unit ?? ""}
        </span>
        <span className="w-20 shrink-0 text-right tabular-nums text-gray-500">{row.amount !== null ? naira.format(row.amount) : "unpriced"}</span>
      </button>
      {selected ? (
        <div className="px-3 pb-3" ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" })}>
          <LineDetail row={row} sessionId={sessionId} onConflict={onConflict} />
        </div>
      ) : null}
    </li>
  );
}
BillRow.displayName = "BillRow";

export function PreconBoqPanel({ sessionId, snapshot, selectedRowId, onSelectRow }: PanelProps) {
  const [conflictNote, setConflictNote] = useState<string | null>(null);
  const createBill = useCreatePreconBill(sessionId);

  const sheetByRow = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of snapshot.geometries) if (!map.has(g.rowId)) map.set(g.rowId, g.sheetId);
    return map;
  }, [snapshot.geometries]);

  const rowsByBill = useMemo(() => {
    const map = new Map<string, PreconBoqRow[]>();
    for (const row of snapshot.rows) {
      const list = map.get(row.billId);
      if (list) list.push(row);
      else map.set(row.billId, [row]);
    }
    return map;
  }, [snapshot.rows]);

  const hasLines = snapshot.rows.some((r) => r.rowType === "item" || r.rowType === "provisional_sum");

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Bill of quantities</h2>
          <span className="text-xs text-gray-500">
            {snapshot.progress.verified}/{snapshot.progress.total} verified
          </span>
        </div>
        <ProgressBar value={snapshot.progress.verified} max={snapshot.progress.total} tone="success" size="md" className="mt-2 bg-gray-100" />
      </div>

      {hasLines ? (
        <NeedsAttentionQueue sessionId={sessionId} rows={snapshot.rows} sheetByRow={sheetByRow} selectedRowId={selectedRowId} onSelectRow={onSelectRow} />
      ) : null}

      {conflictNote ? <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{conflictNote}</p> : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!hasLines ? (
          <p className="px-3 py-6 text-center text-xs text-gray-500">
            Nothing measured yet. Add a line by hand below, set a sheet's scale and re-measure it, or measure into a line with the drawing tools.
          </p>
        ) : null}
        {snapshot.bills.map((bill) => (
          <section key={bill.id}>
            <h3 className="sticky top-0 z-10 bg-gray-900 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">{bill.title}</h3>
            <ul>
              {(rowsByBill.get(bill.id) ?? []).map((row) => (
                <BillRow
                  key={row.id}
                  row={row}
                  sessionId={sessionId}
                  selected={row.id === selectedRowId}
                  onSelect={() => onSelectRow(row.id === selectedRowId ? null : row.id, sheetByRow.get(row.id) ?? null)}
                  onConflict={setConflictNote}
                />
              ))}
            </ul>
            <PreconRowComposer sessionId={sessionId} billId={bill.id} onError={setConflictNote} />
          </section>
        ))}
        <div className="px-3 py-3">
          <Button
            size="sm"
            variant="secondary"
            loading={createBill.isPending}
            onClick={() =>
              createBill.mutate(`Bill No. ${snapshot.bills.length + 1}`, {
                onError: (error) => setConflictNote(error instanceof Error ? error.message : "Could not add the bill"),
              })
            }
          >
            + Add bill
          </Button>
        </div>
      </div>

      <div className="border-t border-gray-200 bg-gray-50 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-gray-500">Draft total</span>
          <span className="text-lg font-bold text-gray-900">{naira.format(snapshot.summary.grandTotal)}</span>
        </div>
        <p className="text-[11px] text-gray-400">
          Incl. prelims {snapshot.settings.prelimsPct}%, contingency {snapshot.settings.contingencyPct}%, VAT {snapshot.settings.vatPct}%
        </p>
      </div>
    </aside>
  );
}
PreconBoqPanel.displayName = "PreconBoqPanel";

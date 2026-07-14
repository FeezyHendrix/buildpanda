import { useMemo, useState } from "react";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import {
  isVersionConflict,
  useRejectPreconRow,
  useUpdatePreconRow,
  useVerifyPreconRow,
} from "@/hooks/use-precon";
import type { PreconBoqRow, PreconRowStatus, PreconSnapshot } from "@/api/precon";

const STATUS_META: Record<PreconRowStatus, { label: string; tone: BadgeTone; mark: string }> = {
  ai_generated: { label: "AI draft", tone: "info", mark: "◇" },
  needs_review: { label: "Needs review", tone: "warning", mark: "▲" },
  verified: { label: "Verified", tone: "success", mark: "✓" },
  rejected: { label: "Rejected", tone: "danger", mark: "✕" },
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
      title={meta.label}
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] leading-none",
        status === "verified" && "bg-emerald-100 text-emerald-700",
        status === "needs_review" && "bg-amber-100 text-amber-700",
        status === "ai_generated" && "bg-primary-100 text-primary-700",
        status === "rejected" && "bg-red-100 text-red-600",
      )}
    >
      {meta.mark}
    </span>
  );
}
RowStatusDot.displayName = "RowStatusDot";

function BreakdownCard({
  row,
  sessionId,
  onConflict,
}: {
  row: PreconBoqRow;
  sessionId: string;
  onConflict: (message: string) => void;
}) {
  const verify = useVerifyPreconRow(sessionId);
  const reject = useRejectPreconRow(sessionId);
  const update = useUpdatePreconRow(sessionId);
  const [qtyDraft, setQtyDraft] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState<string | null>(null);

  const handleError = (error: unknown) => {
    onConflict(
      isVersionConflict(error)
        ? "Someone else updated this row — it has been refreshed, please reapply your change."
        : error instanceof Error
          ? error.message
          : "Update failed",
    );
  };

  const commitNumber = (field: "qty" | "rate", raw: string | null, current: number | null) => {
    if (raw === null) return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value === current) return;
    update.mutate(
      { rowId: row.id, input: { version: row.version, changes: { [field]: value } } },
      { onError: handleError },
    );
  };

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">AI measurement breakdown</p>
          {row.measurementBasis ? <p className="mt-1 text-xs text-gray-600">{row.measurementBasis}</p> : null}
        </div>
        {row.confidence ? (
          <Badge tone={row.confidence === "high" ? "success" : "warning"}>
            {row.confidence === "high" ? "High confidence" : "Low confidence"}
          </Badge>
        ) : null}
      </div>

      {row.qtyGross !== null ? (
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-gray-500">Gross</dt>
            <dd className="font-medium text-gray-900">
              {row.qtyGross} {row.unit}
            </dd>
          </div>
          {row.deductions.map((d, i) => (
            <div key={`${d.label}-${i}`} className="flex justify-between">
              <dt className="text-gray-500">Less {d.label}</dt>
              <dd className="font-medium text-red-600">
                −{d.qty} {row.unit}
              </dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-gray-200 pt-1">
            <dt className="text-gray-600">Net quantity</dt>
            <dd className="font-semibold text-gray-900">
              {row.qty} {row.unit}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500">
          Qty
          <input
            className="mt-0.5 h-8 w-full rounded-lg border-0 bg-[#F6F6F6] px-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-100"
            inputMode="decimal"
            value={qtyDraft ?? row.qty ?? ""}
            onChange={(e) => setQtyDraft(e.target.value)}
            onBlur={() => {
              commitNumber("qty", qtyDraft, row.qty);
              setQtyDraft(null);
            }}
          />
        </label>
        <label className="text-xs text-gray-500">
          Rate (₦)
          <input
            className="mt-0.5 h-8 w-full rounded-lg border-0 bg-[#F6F6F6] px-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-100"
            inputMode="decimal"
            value={rateDraft ?? row.rate ?? ""}
            onChange={(e) => setRateDraft(e.target.value)}
            onBlur={() => {
              commitNumber("rate", rateDraft, row.rate);
              setRateDraft(null);
            }}
          />
        </label>
      </div>
      {row.rateSource ? <p className="text-[11px] text-gray-400">Rate from {row.rateSource}</p> : null}

      <div className="flex gap-2">
        <Button
          size="sm"
          loading={verify.isPending}
          disabled={row.status === "verified"}
          onClick={() => verify.mutate({ rowId: row.id, version: row.version }, { onError: handleError })}
        >
          {row.status === "verified" ? "Verified" : "Verify"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={reject.isPending}
          disabled={row.status === "rejected"}
          onClick={() => reject.mutate({ rowId: row.id, version: row.version }, { onError: handleError })}
        >
          Reject
        </Button>
      </div>
      {row.verifiedBy && row.status === "verified" ? (
        <p className="text-[11px] text-gray-400">Measured by Panda AI · Reviewed {row.verifiedAt?.slice(0, 10)}</p>
      ) : null}
    </div>
  );
}
BreakdownCard.displayName = "BreakdownCard";

export function PreconBoqPanel({ sessionId, snapshot, selectedRowId, onSelectRow }: PanelProps) {
  const [conflictNote, setConflictNote] = useState<string | null>(null);

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

  const progressPct =
    snapshot.progress.total > 0 ? Math.round((snapshot.progress.verified / snapshot.progress.total) * 100) : 0;

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Cost verification</h2>
          <span className="text-xs text-gray-500">
            {snapshot.progress.verified}/{snapshot.progress.total} verified
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {conflictNote ? (
        <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{conflictNote}</p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {snapshot.bills.map((bill) => (
          <section key={bill.id}>
            <h3 className="sticky top-0 z-10 bg-gray-900 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">
              {bill.title}
            </h3>
            <ul>
              {(rowsByBill.get(bill.id) ?? []).map((row) => {
                if (row.rowType === "heading" || row.rowType === "work_section") {
                  return (
                    <li
                      key={row.id}
                      className={cn(
                        "px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-gray-500",
                        row.rowType === "work_section" && "text-gray-400",
                      )}
                    >
                      {row.description}
                    </li>
                  );
                }
                if (row.rowType === "spec_note") {
                  return (
                    <li key={row.id} className="px-3 py-1 text-[11px] italic text-gray-400">
                      {row.description}
                    </li>
                  );
                }
                const selected = row.id === selectedRowId;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => onSelectRow(selected ? null : row.id, sheetByRow.get(row.id) ?? null)}
                      className={cn(
                        "flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-xs hover:bg-gray-50",
                        selected ? "border-primary-600 bg-primary-50/50" : "border-transparent",
                        row.status === "rejected" && "opacity-50",
                      )}
                    >
                      <RowStatusDot status={row.status} />
                      <span className="w-14 shrink-0 font-mono text-[10px] text-gray-400">{row.code}</span>
                      <span className={cn("min-w-0 flex-1 truncate text-gray-800", row.status === "rejected" && "line-through")}>
                        {row.description}
                      </span>
                      <span className="shrink-0 tabular-nums text-gray-600">
                        {row.qty ?? "—"} {row.unit ?? ""}
                      </span>
                      <span className="w-20 shrink-0 text-right tabular-nums text-gray-500">
                        {row.amount !== null ? naira.format(row.amount) : "unpriced"}
                      </span>
                    </button>
                    {selected ? (
                      <div className="px-3 pb-3" ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" })}>
                        <BreakdownCard
                          row={row}
                          sessionId={sessionId}
                          onConflict={setConflictNote}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="border-t border-gray-200 bg-gray-50 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-gray-500">Project total (draft)</span>
          <span className="text-lg font-bold text-gray-900">{naira.format(snapshot.summary.grandTotal)}</span>
        </div>
        <p className="text-[11px] text-gray-400">
          Incl. prelims {snapshot.settings.prelimsPct}%, contingency {snapshot.settings.contingencyPct}%, VAT{" "}
          {snapshot.settings.vatPct}%
        </p>
      </div>
    </aside>
  );
}
PreconBoqPanel.displayName = "PreconBoqPanel";

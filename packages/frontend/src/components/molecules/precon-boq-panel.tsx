import { useMemo, useState } from "react";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import { useCreatePreconBill } from "@/hooks/use-precon";
import { PreconRowComposer } from "@/components/molecules/precon-row-composer";
import { LineDetail } from "@/components/molecules/precon-session/line-detail";
import { NeedsAttentionQueue, attentionRows, confidentDrafts } from "@/components/molecules/precon-session/needs-attention-queue";
import { MEASURING_TOOLS, confidenceReasonLabel } from "@/lib/precon-meta";
import { OpenCommentBadge, useOpenCommentCounts } from "@/components/molecules/precon-sheet-viewer/pins";
import { RowFocusAvatars } from "@/components/molecules/precon-session/presence-avatars";
import { usePreconPresence } from "@/hooks/use-precon";
import { useSession } from "@/stores/auth";
import type { PreconBoqRow, PreconRowStatus, PreconSnapshot, PresenceUser } from "@/api/precon";

const STATUS_META: Record<PreconRowStatus, { label: string; mark: string }> = {
  ai_generated: { label: "AI draft", mark: "◇" },
  needs_review: { label: "Needs review", mark: "▲" },
  verified: { label: "Verified", mark: "✓" },
  rejected: { label: "Rejected", mark: "✕" },
};

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
const NO_USERS: PresenceUser[] = [];

// WS-M3B: which other users are on which row, so a line can wear their avatar
function focusByRow(users: PresenceUser[], currentUserId: string | null): Map<string, PresenceUser[]> {
  const map = new Map<string, PresenceUser[]>();
  for (const user of users) {
    if (!user.rowId || user.id === currentUserId) continue;
    const list = map.get(user.rowId);
    if (list) list.push(user);
    else map.set(user.rowId, [user]);
  }
  return map;
}

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
  openComments,
  focusedBy,
  onSelect,
  onConflict,
}: {
  row: PreconBoqRow;
  selected: boolean;
  sessionId: string;
  openComments: number;
  /** Other users whose focus is this row. */
  focusedBy: PresenceUser[];
  onSelect: () => void;
  onConflict: (message: string) => void;
}) {
  if (row.rowType === "heading" || row.rowType === "work_section") {
    return (
      <li className={cn("px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-gray-500", row.rowType === "work_section" && "text-gray-400")}>
        {row.description}
      </li>
    );
  }
  if (row.rowType === "spec_note") {
    return <li className="px-3 py-1 text-xs italic text-gray-400">{row.description}</li>;
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
        <OpenCommentBadge count={openComments} />
        <RowFocusAvatars users={focusedBy} />
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

/** A manual take-off before its first line: the tools and their keys. */
function ManualEmptyState() {
  return (
    <div className="px-3 py-6 text-center">
      <p className="text-xs font-medium text-gray-700">Nothing measured yet — pick a tool and draw on the sheet.</p>
      <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
        {MEASURING_TOOLS.map((meta) => (
          <li key={meta.key} className="flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
            <kbd className="rounded bg-white px-1 font-mono text-[10px] font-semibold text-gray-800 shadow-sm">{meta.shortcut}</kbd>
            {meta.label}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-400">Enter finishes a shape and asks for its name. Esc goes back to Select.</p>
    </div>
  );
}
ManualEmptyState.displayName = "ManualEmptyState";

export function PreconBoqPanel({ sessionId, snapshot, selectedRowId, onSelectRow }: PanelProps) {
  const [conflictNote, setConflictNote] = useState<string | null>(null);
  const createBill = useCreatePreconBill(sessionId);
  const openComments = useOpenCommentCounts(sessionId);
  const presence = usePreconPresence(sessionId);
  const { data: auth } = useSession();
  const currentUserId = auth?.user?.id ?? null;
  const focused = useMemo(() => focusByRow(presence, currentUserId), [presence, currentUserId]);

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
  const manual = snapshot.session.takeoffKind === "manual";
  // Lines drawn by hand are verified as drawn, so a manual take-off only shows
  // the queue once something (a prompt edit, say) actually needs a look.
  const showQueue = hasLines && (!manual || attentionRows(snapshot.rows).length > 0 || confidentDrafts(snapshot.rows).length > 0);

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-white">
      <div className="border-b border-line p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Bill of quantities</h2>
          <span className="text-xs text-gray-500">
            {snapshot.progress.verified}/{snapshot.progress.total} verified
          </span>
        </div>
        <ProgressBar value={snapshot.progress.verified} max={snapshot.progress.total} tone="success" size="md" className="mt-2 bg-gray-100" />
      </div>

      {showQueue ? (
        <NeedsAttentionQueue sessionId={sessionId} rows={snapshot.rows} sheetByRow={sheetByRow} selectedRowId={selectedRowId} onSelectRow={onSelectRow} />
      ) : null}

      {conflictNote ? <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{conflictNote}</p> : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!hasLines && manual ? <ManualEmptyState /> : null}
        {!hasLines && !manual ? (
          <p className="px-3 py-6 text-center text-xs text-gray-500">
            Nothing measured yet. Add a line by hand below, set a sheet's scale and re-measure it, or measure into a line with the drawing tools.
          </p>
        ) : null}
        {snapshot.bills.map((bill) => (
          <section key={bill.id}>
            <h3 className="sticky top-0 z-10 border-b border-line-hair bg-surface-alt px-3 py-2 text-xs font-medium uppercase text-ink">{bill.title}</h3>
            <ul>
              {(rowsByBill.get(bill.id) ?? []).map((row) => (
                <BillRow
                  key={row.id}
                  row={row}
                  sessionId={sessionId}
                  openComments={openComments.get(row.id) ?? 0}
                  focusedBy={focused.get(row.id) ?? NO_USERS}
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

      <div className="border-t border-line bg-gray-50 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-gray-500">Draft total</span>
          <span className="text-lg font-medium text-gray-900">{naira.format(snapshot.summary.grandTotal)}</span>
        </div>
        <p className="text-xs text-gray-400">
          Incl. prelims {snapshot.settings.prelimsPct}%, contingency {snapshot.settings.contingencyPct}%, VAT {snapshot.settings.vatPct}%
        </p>
      </div>
    </aside>
  );
}
PreconBoqPanel.displayName = "PreconBoqPanel";

import { useMemo, useState } from "react";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
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

// WCAG 1.4.1: every status keeps a mark, so the tone is never the only cue.
const STATUS_META: Record<PreconRowStatus, { label: string; mark: string; tone: BadgeTone; pop: boolean }> = {
  ai_generated: { label: "AI draft", mark: "◇", tone: "info", pop: false },
  needs_review: { label: "Needs review", mark: "▲", tone: "warning", pop: false },
  verified: { label: "Verified", mark: "✓", tone: "success", pop: true },
  rejected: { label: "Rejected", mark: "✕", tone: "danger", pop: true },
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
    <Badge
      key={status}
      tone={meta.tone}
      title={meta.label}
      className={cn(
        "h-4 w-4 shrink-0 justify-center px-0 text-caption-s leading-none",
        meta.pop && "animate-pop motion-reduce:animate-none",
      )}
    >
      {meta.mark}
    </Badge>
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
      <li className={cn("px-3 pb-1 pt-3 text-caption-m font-medium uppercase tracking-wide text-ink-muted", row.rowType === "work_section" && "text-black-300")}>
        {row.description}
      </li>
    );
  }
  if (row.rowType === "spec_note") {
    return <li className="px-3 py-1 text-caption-m italic text-black-300">{row.description}</li>;
  }
  const reason = row.status !== "verified" ? confidenceReasonLabel(row.confidenceReason) : null;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        title={reason ?? row.provenance ?? undefined}
        className={cn(
          "flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-caption-m hover:bg-grey-50",
          selected ? "border-primary-600 bg-primary-50/50" : "border-transparent",
          row.status === "rejected" && "opacity-50",
        )}
      >
        <RowStatusDot status={row.status} />
        <span className="w-14 shrink-0 font-mono text-caption-s text-black-300">{row.code}</span>
        <span className={cn("min-w-0 flex-1 truncate text-ink", row.status === "rejected" && "line-through")}>{row.description}</span>
        {reason ? <span className="hidden shrink-0 text-caption-s text-warning-500 xl:inline">{reason}</span> : null}
        <OpenCommentBadge count={openComments} />
        <RowFocusAvatars users={focusedBy} />
        <span className="shrink-0 tabular-nums text-ink-subtle">
          {row.qty ?? "—"} {row.unit ?? ""}
        </span>
        <span className="w-20 shrink-0 text-right tabular-nums text-ink-muted">{row.amount !== null ? naira.format(row.amount) : "unpriced"}</span>
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
      <p className="text-caption-m font-medium text-ink-subtle">Nothing measured yet — pick a tool and draw on the sheet.</p>
      <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
        {MEASURING_TOOLS.map((meta) => (
          <li key={meta.key} className="flex items-center gap-1 rounded-none bg-grey-100 px-1.5 py-0.5 text-caption-m text-ink-subtle">
            <kbd className="rounded-none bg-white px-1 font-mono text-caption-s font-semibold text-ink shadow-sm">{meta.shortcut}</kbd>
            {meta.label}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-caption-m text-black-300">Enter finishes a shape and asks for its name. Esc goes back to Select.</p>
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
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-none border border-line bg-white">
      <div className="border-b border-line p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-caption-l font-semibold text-black-500">Bill of quantities</h2>
          <span className="text-caption-m text-ink-muted">
            {snapshot.progress.verified}/{snapshot.progress.total} verified
          </span>
        </div>
        <ProgressBar value={snapshot.progress.verified} max={snapshot.progress.total} tone="success" size="md" className="mt-2 bg-grey-100" />
      </div>

      {showQueue ? (
        <NeedsAttentionQueue sessionId={sessionId} rows={snapshot.rows} sheetByRow={sheetByRow} selectedRowId={selectedRowId} onSelectRow={onSelectRow} />
      ) : null}

      {conflictNote ? <p className="border-b border-warning-200 bg-warning-50 px-3 py-2 text-caption-m text-warning-600">{conflictNote}</p> : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!hasLines && manual ? <ManualEmptyState /> : null}
        {!hasLines && !manual ? (
          <p className="px-3 py-6 text-center text-caption-m text-ink-muted">
            Nothing measured yet. Add a line by hand below, set a sheet's scale and re-measure it, or measure into a line with the drawing tools.
          </p>
        ) : null}
        {snapshot.bills.map((bill) => (
          <section key={bill.id}>
            <h3 className="sticky top-0 z-10 border-b border-line-hair bg-surface-alt px-3 py-2 text-caption-m font-medium uppercase text-ink">{bill.title}</h3>
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

      <div className="border-t border-line bg-grey-50 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-caption-m uppercase tracking-wide text-ink-muted">Draft total</span>
          <span className="text-body-m font-medium text-black-500">{naira.format(snapshot.summary.grandTotal)}</span>
        </div>
        <p className="text-caption-m text-black-300">
          Incl. prelims {snapshot.settings.prelimsPct}%, contingency {snapshot.settings.contingencyPct}%, VAT {snapshot.settings.vatPct}%
        </p>
      </div>
    </aside>
  );
}
PreconBoqPanel.displayName = "PreconBoqPanel";

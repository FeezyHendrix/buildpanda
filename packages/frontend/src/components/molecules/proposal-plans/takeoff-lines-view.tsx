import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { PRECON_PRICED_ROW_TYPES, type PreconBoqRow, type PreconRowStatus } from "@/api/precon";
import { usePreconSnapshot } from "@/hooks/use-precon";
import { PRECON_STATUS_LABEL, PRECON_STATUS_TONE, describeScope } from "@/lib/precon-meta";

interface Props {
  sessionId: string;
}

const ROW_STATUS: Record<PreconRowStatus, { label: string; tone: "neutral" | "warning" | "success" | "danger" }> = {
  ai_generated: { label: "AI draft", tone: "neutral" },
  needs_review: { label: "Needs review", tone: "warning" },
  verified: { label: "Verified", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

const qtyFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

function LineRow({ row }: { row: PreconBoqRow }) {
  const priced = PRECON_PRICED_ROW_TYPES.includes(row.rowType);
  if (row.rowType === "spec_note") {
    return (
      <tr>
        <td colSpan={5} className="px-3 py-1 text-[11px] italic text-gray-400">
          {row.description}
        </td>
      </tr>
    );
  }
  if (!priced) {
    return (
      <tr className="bg-gray-50">
        <td colSpan={5} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {row.description}
        </td>
      </tr>
    );
  }
  const status = row.status ? ROW_STATUS[row.status] : null;
  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2 font-mono text-[11px] text-gray-500">{row.code ?? ""}</td>
      <td className="px-3 py-2 text-sm text-gray-900">{row.description}</td>
      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-gray-800">
        {row.qty === null ? "" : qtyFormat.format(row.qty)}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">{row.unit ?? ""}</td>
      <td className="px-3 py-2 text-right">{status ? <Badge tone={status.tone}>{status.label}</Badge> : null}</td>
    </tr>
  );
}
LineRow.displayName = "LineRow";

/** Read-only bill of quantities for one take-off. Editing happens in the take-off workspace. */
export function TakeoffLinesView({ sessionId }: Props) {
  const { data: snapshot, isPending, isError } = usePreconSnapshot(sessionId);

  if (isPending) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="sm" />
      </div>
    );
  }
  if (isError || !snapshot) {
    return <EmptyState title="Take-off unavailable" description="This take-off could not be loaded." className="py-10" />;
  }

  const { session, bills, rows, progress } = snapshot;
  const rowsByBill = new Map<string, PreconBoqRow[]>();
  for (const row of rows) {
    const list = rowsByBill.get(row.billId) ?? [];
    list.push(row);
    rowsByBill.set(row.billId, list);
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{session.title}</p>
            <Badge tone={PRECON_STATUS_TONE[session.status]}>{PRECON_STATUS_LABEL[session.status]}</Badge>
            {session.planId ? <span className="font-mono text-[11px] text-gray-400">Rev {session.revision}</span> : null}
            {session.supersededBy ? <Badge tone="neutral">Superseded</Badge> : null}
          </div>
          <p className="text-xs text-gray-500">
            {describeScope(session.scope)} · {progress.verified} of {progress.total} lines verified
          </p>
        </div>
        <Link to={`/sales/takeoff/${session.id}`}>
          <Button size="sm">Open take-off</Button>
        </Link>
      </div>
      {bills.length === 0 ? (
        <EmptyState title="No lines yet" description="This take-off has no bill lines." className="py-10" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Ref</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            {bills.map((bill) => (
              <tbody key={bill.id}>
                <tr className="border-t border-gray-200 bg-primary-50/40">
                  <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-primary-800">
                    {bill.title}
                  </td>
                </tr>
                {(rowsByBill.get(bill.id) ?? []).map((row) => (
                  <LineRow key={row.id} row={row} />
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  );
}
TakeoffLinesView.displayName = "TakeoffLinesView";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import type { PreconBoqRow } from "@/api/precon";
import { useVerifyPreconRows } from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { confidenceReasonLabel } from "@/lib/precon-meta";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Props {
  sessionId: string;
  rows: PreconBoqRow[];
  sheetByRow: Map<string, string>;
  selectedRowId: string | null;
  onSelectRow: (rowId: string | null, sheetId?: string | null) => void;
}

const PRICED = new Set(["item", "provisional_sum"]);

// Lines the reviewer must look at: anything the engine doubted or a person
// edited, lowest confidence first. Confident drafts wait in the bill below.
export function attentionRows(rows: PreconBoqRow[]): PreconBoqRow[] {
  return rows
    .filter((r) => PRICED.has(r.rowType) && r.status !== "verified" && r.status !== "rejected")
    .filter((r) => r.status === "needs_review" || r.confidence === "low" || r.provenance === null)
    .sort((a, b) => rank(a) - rank(b)); // fresh array from filter, so sorting in place is safe
}

function rank(row: PreconBoqRow): number {
  if (row.confidence === "low") return 0;
  if (row.status === "needs_review") return 1;
  return 2;
}

export function confidentDrafts(rows: PreconBoqRow[]): PreconBoqRow[] {
  return rows.filter((r) => PRICED.has(r.rowType) && r.status === "ai_generated" && r.confidence === "high");
}

export function NeedsAttentionQueue({ sessionId, rows, sheetByRow, selectedRowId, onSelectRow }: Props) {
  const queue = useMemo(() => attentionRows(rows), [rows]);
  const confident = useMemo(() => confidentDrafts(rows), [rows]);
  const verifyMany = useVerifyPreconRows(sessionId);

  return (
    <section className="border-b border-line">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-3.5 text-amber-600" aria-hidden="true" />
          <h3 className="text-xs font-semibold text-gray-900">Needs attention</h3>
          <Badge tone={queue.length > 0 ? "warning" : "success"}>{queue.length}</Badge>
        </div>
        {confident.length > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-primary-700"
            loading={verifyMany.isPending}
            title="Verify every high-confidence AI draft that has not been edited"
            onClick={() =>
              verifyMany.mutate(
                confident.map((r) => ({ rowId: r.id, version: r.version })),
                {
                  onSuccess: (n) => toast(`${n} confident line${n === 1 ? "" : "s"} verified.`, "success"),
                  onError: (e) => toast(getApiErrorMessage(e, "Batch verify stopped on a line that changed; refresh and retry."), "error"),
                },
              )
            }
          >
            Verify {confident.length} confident
          </Button>
        ) : null}
      </div>
      {queue.length === 0 ? (
        <p className="px-3 pb-3 text-xs text-gray-500">Nothing flagged. Confident drafts sit in the bill below; verify them one by one or in bulk.</p>
      ) : (
        <ul className="max-h-48 overflow-y-auto">
          {queue.map((row) => {
            const selected = row.id === selectedRowId;
            const reason = confidenceReasonLabel(row.confidenceReason) ?? (row.status === "needs_review" ? "Edited, needs re-check" : "No evidence");
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onSelectRow(selected ? null : row.id, sheetByRow.get(row.id) ?? null)}
                  className={cn(
                    "flex w-full items-center gap-2 border-l-2 px-3 py-1.5 text-left text-xs hover:bg-amber-50/60",
                    selected ? "border-primary-600 bg-primary-50/50" : "border-transparent",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-gray-800">{row.description}</span>
                  <span className="shrink-0 tabular-nums text-gray-500">
                    {row.qty ?? "—"} {row.unit ?? ""}
                  </span>
                  <Badge tone={row.confidence === "low" ? "warning" : "neutral"} size="sm">
                    {reason}
                  </Badge>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
NeedsAttentionQueue.displayName = "NeedsAttentionQueue";

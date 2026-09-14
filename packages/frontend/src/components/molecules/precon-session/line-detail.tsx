import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import type { PreconBoqRow } from "@/api/precon";
import { isVersionConflict, useDeletePreconRow, useRejectPreconRow, useUpdatePreconRow, useVerifyPreconRow } from "@/hooks/use-precon";
import { ROW_ORIGIN_LABEL } from "@/lib/precon-meta";
import { LineEvidence } from "./line-evidence";
import { formatShortDate } from "@/lib/formatters";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

interface Props {
  row: PreconBoqRow;
  sessionId: string;
  onConflict: (message: string) => void;
}

const FIELD = cn(INPUT_SM_CLASS, "mt-0.5");

/**
 * One bill line opened for review: where it came from, why the engine doubted
 * it, the gross-to-net breakdown, editable quantity and rate, and sign-off.
 */
export function LineDetail({ row, sessionId, onConflict }: Props) {
  const verify = useVerifyPreconRow(sessionId);
  const reject = useRejectPreconRow(sessionId);
  const update = useUpdatePreconRow(sessionId);
  const remove = useDeletePreconRow(sessionId);
  const [qtyDraft, setQtyDraft] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState<string | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState<string | null>(null);
  const measuredByAi = row.origin === "ai" || row.origin === "prompt";

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
    update.mutate({ rowId: row.id, input: { version: row.version, changes: { [field]: value } } }, { onError: handleError });
  };

  const commitDescription = () => {
    if (descriptionDraft === null) return;
    const next = descriptionDraft.trim();
    setDescriptionDraft(null);
    if (next === "" || next === row.description) return;
    update.mutate({ rowId: row.id, input: { version: row.version, changes: { description: next } } }, { onError: handleError });
  };

  return (
    <div className="space-y-3 rounded-lg border border-line bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase text-ink-muted">{ROW_ORIGIN_LABEL[row.origin]}</p>
        {row.confidence ? (
          <Badge tone={row.confidence === "high" ? "success" : "warning"}>{row.confidence === "high" ? "High confidence" : "Low confidence"}</Badge>
        ) : null}
      </div>
      <LineEvidence row={row} />

      {row.editedAt ? (
        <p className="rounded-md bg-white px-2 py-1 text-xs text-gray-600">
          Edited {formatShortDate(row.editedAt)}. The line above is Panda AI's original basis; the figures below are the current values.
        </p>
      ) : null}

      <label className="block text-xs text-gray-500">
        Description
        <input
          className={FIELD}
          value={descriptionDraft ?? row.description}
          onChange={(e) => setDescriptionDraft(e.target.value)}
          onBlur={commitDescription}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </label>

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
          <div className="flex justify-between border-t border-line pt-1">
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
            className={FIELD}
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
            className={FIELD}
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
      {row.rateSource ? <p className="text-xs text-gray-400">Rate from {row.rateSource}</p> : null}

      <div className="flex gap-2">
        <Button
          size="sm"
          loading={verify.isPending}
          disabled={row.status === "verified"}
          onClick={() => verify.mutate({ rowId: row.id, version: row.version }, { onError: handleError })}
        >
          {row.status === "verified" ? "Verified" : "Verify"}
        </Button>
        {measuredByAi ? (
          <Button
            size="sm"
            variant="secondary"
            loading={reject.isPending}
            disabled={row.status === "rejected"}
            onClick={() => reject.mutate({ rowId: row.id, version: row.version }, { onError: handleError })}
          >
            Reject
          </Button>
        ) : null}
        <Button size="sm" variant="secondary" loading={remove.isPending} onClick={() => remove.mutate(row.id, { onError: handleError })}>
          Delete
        </Button>
      </div>
      {row.verifiedBy && row.status === "verified" ? (
        <p className="text-xs text-gray-400">Verified {row.verifiedAt ? formatShortDate(row.verifiedAt) : ""}</p>
      ) : null}
    </div>
  );
}
LineDetail.displayName = "LineDetail";

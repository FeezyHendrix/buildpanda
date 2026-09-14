import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { Spinner } from "@/components/atoms/spinner";
import { useUpdateScheduleProgress, type StageScheduleOfValue } from "@/hooks/use-stages";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/formatters";
import type { Currency } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { formatCumulative, parseCellPercent } from "./billing-sheet-model";

/**
 * One stage-month on the billing sheet. Shows the cumulative % complete with
 * the month's billing beneath it; click to type a new cumulative figure.
 *
 * Two rules a valuation carries, both owned by the backend and both stated
 * here before the request so nobody is guessing at a 409:
 *
 *  • a month certified on an invoice is CLOSED — re-typing 40% as 50% after
 *    IPC-001 went out would leave the sheet and the certificate saying
 *    different things about the same month, so the correction belongs on the
 *    next certificate;
 *  • a month that has not happened yet can only be a FORECAST, which the cell
 *    says as it saves it and the column shows as not claimable.
 */

interface BillingMonthCellProps {
  projectId: string;
  stageId: string;
  period: string;
  line: StageScheduleOfValue | undefined;
  currency: Currency;
  editable: boolean;
  /** Set when the cell is inert and explains why (unpriced stage, certified month). */
  disabledReason?: string;
  /** A month later than today: recorded as a projection, never a claim. */
  forecast?: boolean;
}

const CELL_BUTTON =
  "flex w-full flex-col items-end rounded-lg px-2 py-1 text-right transition-colors";

export function BillingMonthCell({
  projectId,
  stageId,
  period,
  line,
  currency,
  editable,
  disabledReason,
  forecast = false,
}: BillingMonthCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Escape closes the cell; the blur that follows must not re-submit it and
  // put the dismissed error straight back on screen.
  const abandoned = useRef(false);
  const update = useUpdateScheduleProgress();

  const current = line?.percentComplete ?? null;
  const canEdit = editable && !disabledReason;

  const startEditing = useCallback(() => {
    if (!canEdit) return;
    abandoned.current = false;
    setDraft(current === null ? "" : String(current));
    setError(null);
    setEditing(true);
  }, [canEdit, current]);

  const stopEditing = useCallback(() => {
    setEditing(false);
    setError(null);
  }, []);

  const commit = useCallback(() => {
    if (update.isPending || abandoned.current) return;
    const parsed = parseCellPercent(draft);
    if (parsed === "invalid") {
      setError("Enter a value from 0 to 100");
      return;
    }
    if (parsed === current) {
      stopEditing();
      return;
    }
    update.mutate(
      { projectId, stageId, period, percentComplete: parsed, ...(forecast ? { forecast: true } : {}) },
      {
        onSuccess: stopEditing,
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    );
  }, [update, draft, current, stopEditing, projectId, stageId, period, forecast]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        abandoned.current = true;
        stopEditing();
      }
    },
    [commit, stopEditing],
  );

  if (editing) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="relative w-24">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.1}
            value={draft}
            autoFocus
            disabled={update.isPending}
            aria-label={`Cumulative percent complete for ${period}`}
            aria-invalid={error !== null}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            onBlur={commit}
            className={cn(INPUT_SM_CLASS, "pl-2 pr-7 text-right tabular-nums")}
          />
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-ink-muted">
            {update.isPending ? <Spinner size="xs" /> : "%"}
          </span>
        </div>
        {forecast ? (
          <p className="max-w-[180px] text-xs leading-snug text-ink-muted">
            Saved as a forecast — this month has not been worked yet.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="max-w-[180px] text-xs leading-snug text-negative-600">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      disabled={!canEdit}
      title={disabledReason ?? (canEdit ? "Click to record % complete" : undefined)}
      aria-label={`${period}: ${formatCumulative(current)} complete${disabledReason ? ` — ${disabledReason}` : ""}`}
      className={cn(
        CELL_BUTTON,
        canEdit ? "cursor-text hover:bg-primary-50" : "cursor-not-allowed",
        disabledReason ? "opacity-50" : undefined,
      )}
    >
      <span
        className={cn(
          "text-sm tabular-nums",
          current === null ? "font-semibold text-ink-muted" : "font-semibold text-ink",
          forecast && current !== null && "italic font-normal text-ink-muted",
        )}
      >
        {formatCumulative(current)}
      </span>
      <span className="text-xs tabular-nums text-ink-muted">
        {line && current !== null ? formatCurrency(line.periodAmount, currency) : " "}
      </span>
    </button>
  );
}

BillingMonthCell.displayName = "BillingMonthCell";

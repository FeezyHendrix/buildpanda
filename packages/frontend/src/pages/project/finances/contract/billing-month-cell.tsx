import { useCallback, useState, type KeyboardEvent } from "react";
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
 * Enter or blur records it, Escape puts the old value back. The backend owns
 * the cumulative rules (never below last month, never above the next) and
 * answers with a message the cell shows in place.
 */

interface BillingMonthCellProps {
  projectId: string;
  stageId: string;
  period: string;
  line: StageScheduleOfValue | undefined;
  currency: Currency;
  editable: boolean;
  /** When set the cell is inert and explains why (e.g. the stage has no value yet). */
  disabledReason?: string;
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
}: BillingMonthCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateScheduleProgress();

  const current = line?.percentComplete ?? null;
  const canEdit = editable && !disabledReason;

  const startEditing = useCallback(() => {
    if (!canEdit) return;
    setDraft(current === null ? "" : String(current));
    setError(null);
    setEditing(true);
  }, [canEdit, current]);

  const stopEditing = useCallback(() => {
    setEditing(false);
    setError(null);
  }, []);

  const commit = useCallback(() => {
    if (update.isPending) return;
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
      { projectId, stageId, period, percentComplete: parsed },
      {
        onSuccess: stopEditing,
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    );
  }, [update, draft, current, stopEditing, projectId, stageId, period]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      } else if (event.key === "Escape") {
        event.preventDefault();
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
            className={cn(
              "h-9 w-full rounded-lg bg-white pl-2 pr-7 text-right text-sm tabular-nums text-black-500 outline-none ring-2",
              error ? "ring-error-300" : "ring-primary-500/40",
            )}
          />
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-black-200">
            {update.isPending ? <Spinner size="xs" /> : "%"}
          </span>
        </div>
        {error ? (
          <p role="alert" className="max-w-[180px] text-[11px] leading-snug text-error-600">
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
      aria-label={`${period}: ${formatCumulative(current)} complete`}
      className={cn(
        CELL_BUTTON,
        canEdit ? "cursor-text hover:bg-primary-50" : "cursor-default",
        disabledReason ? "opacity-40" : undefined,
      )}
    >
      <span
        className={cn(
          "text-[13px] font-semibold tabular-nums",
          current === null ? "text-black-200" : "text-black-500",
        )}
      >
        {formatCumulative(current)}
      </span>
      <span className="text-[11px] tabular-nums text-black-300">
        {line && current !== null ? formatCurrency(line.periodAmount, currency) : " "}
      </span>
    </button>
  );
}

BillingMonthCell.displayName = "BillingMonthCell";

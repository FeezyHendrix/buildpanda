import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { FormDrawer } from "@/components/molecules/form-drawer";
import {
  useReplaceScheduleOfValues,
  useScheduleOfValues,
  type ScheduleOfValueLineInput,
} from "@/hooks/use-stages";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/formatters";
import { Money } from "@/lib/money";
import type { Currency, Stage } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  MAX_PERCENT,
  ScheduleLineRow,
  allocateLineAmounts,
  currentPeriod,
  isValidPeriod,
  nextLineKey,
  nextPeriod,
  parsePercent,
  percentOrZero,
  toDraftLine,
  type DraftLine,
} from "./schedule-of-values-line";
import {
  ScheduleBar,
  formatPercent,
  sharePercent,
} from "./schedule-of-values-parts";

/**
 * Schedule of Values editor for one build stage.
 *
 * A stage carries a scheduled contract value; the Schedule of Values breaks that
 * value into monthly billing lines whose percentages must sum to 100 or less.
 * Every figure here is a RECORDED position — BuildPanda logs money movements
 * that happened off-platform, it never bills, charges or moves anything.
 *
 * Saving is a full replace: the lines on screen become the stage's schedule.
 */

interface ScheduleOfValuesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  stage: Stage | null;
  currency: Currency;
  canManage: boolean;
}

export function ScheduleOfValuesDrawer({
  open,
  onOpenChange,
  projectId,
  stage,
  currency,
  canManage,
}: ScheduleOfValuesDrawerProps) {
  const stageId = stage?.id;
  const stageValue = stage?.value ?? 0;

  const { data: savedLines, isPending } = useScheduleOfValues(projectId, stageId);
  const replace = useReplaceScheduleOfValues();

  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  // Seed the editable draft once per opening, then leave it alone so a
  // background refetch can never overwrite work in progress.
  useEffect(() => {
    if (!open || !stageId) {
      setHydratedFor(null);
      return;
    }
    if (!savedLines || hydratedFor === stageId) return;
    setDraft(savedLines.map(toDraftLine));
    setHydratedFor(stageId);
  }, [open, stageId, savedLines, hydratedFor]);

  const percents = useMemo(
    () => draft.map((line) => percentOrZero(line.percent)),
    [draft],
  );
  const amounts = useMemo(
    () => allocateLineAmounts(stageValue, percents),
    [stageValue, percents],
  );
  const totalPercent = useMemo(() => Money.sum(percents), [percents]);
  const scheduledAmount = useMemo(() => Money.sum(amounts), [amounts]);
  const billedAmount = useMemo(
    () =>
      Money.sum(
        draft.flatMap((line, index) =>
          line.billed ? [amounts[index] ?? Money.zero()] : [],
        ),
      ),
    [draft, amounts],
  );
  const billedLines = useMemo(
    () => draft.filter((line) => line.billed).length,
    [draft],
  );
  const invalidLines = useMemo(
    () =>
      draft.filter(
        (line) =>
          !isValidPeriod(line.period) || parsePercent(line.percent) === null,
      ).length,
    [draft],
  );
  const isDirty = useMemo(() => {
    const saved = savedLines ?? [];
    if (saved.length !== draft.length) return true;
    return draft.some((line, index) => {
      const row = saved[index];
      if (!row) return true;
      return (
        row.period !== line.period ||
        row.billed !== line.billed ||
        !Money.of(row.percent).eq(percentOrZero(line.percent))
      );
    });
  }, [draft, savedLines]);

  const isOverBooked = totalPercent.gt(MAX_PERCENT);
  const remainingPercent = Money.of(MAX_PERCENT).sub(totalPercent);
  const unscheduled = Money.of(stageValue).sub(scheduledAmount);
  const canSave = canManage && invalidLines === 0 && !isOverBooked && isDirty;

  const updateLine = useCallback(
    (key: string, patch: Partial<Omit<DraftLine, "key">>) => {
      setDraft((current) =>
        current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
      );
    },
    [],
  );

  const removeLine = useCallback((key: string) => {
    setDraft((current) => current.filter((line) => line.key !== key));
  }, []);

  // A new line continues the month sequence and pre-fills whatever share of the
  // stage is still unscheduled — the number a QS was about to type anyway.
  const addLine = useCallback(() => {
    setDraft((current) => {
      const last = current[current.length - 1];
      const used = Money.sum(current.map((line) => percentOrZero(line.percent)));
      const left = Money.of(MAX_PERCENT).sub(used);
      return [
        ...current,
        {
          key: nextLineKey(),
          period: last ? nextPeriod(last.period) : currentPeriod(),
          percent: left.gt(0) ? left.round().toString() : "",
          billed: false,
        },
      ];
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!stageId || !canSave) return;
    const lines: ScheduleOfValueLineInput[] = draft.map((line) => ({
      period: line.period,
      percent: percentOrZero(line.percent),
      billed: line.billed,
    }));
    replace.mutate(
      { projectId, stageId, lines },
      {
        onSuccess: () => {
          toast("Schedule of values saved", "success");
          onOpenChange(false);
        },
      },
    );
  }, [stageId, canSave, draft, projectId, replace, onOpenChange]);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Schedule of values"
      description={
        stage
          ? `${stage.name} · ${formatCurrency(stage.value, currency)} scheduled value. Saving replaces every line on this stage.`
          : "Break a stage's value into the months it gets billed in."
      }
      submitLabel="Save schedule"
      submitDisabled={!canSave}
      submitting={replace.isPending}
      error={replace.error ? getApiErrorMessage(replace.error) : null}
      onSubmit={handleSubmit}
      className="w-[min(560px,100vw)]"
    >
      {isPending && !savedLines ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : (
        <>
          <section className="sticky top-0 z-10 -mx-6 -mt-5 border-b border-grey-50 bg-white px-6 pb-4 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-black-200">
                  Scheduled
                </p>
                <p
                  className={cn(
                    "mt-1 text-2xl font-bold tabular-nums",
                    isOverBooked ? "text-error-600" : "text-black-500",
                  )}
                >
                  {formatPercent(totalPercent)}%
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-black-300">
                  {formatCurrency(scheduledAmount.round().toNumber(), currency)} of{" "}
                  {formatCurrency(stageValue, currency)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-black-200">
                  Billed to date
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-primary-500">
                  {formatCurrency(billedAmount.round().toNumber(), currency)}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-black-300">
                  {billedLines} of {draft.length}{" "}
                  {draft.length === 1 ? "line" : "lines"} billed
                </p>
              </div>
            </div>

            <ScheduleBar
              billedShare={sharePercent(billedAmount, stageValue)}
              scheduledShare={sharePercent(scheduledAmount, stageValue)}
              overBooked={isOverBooked}
              className="mt-3"
            />

            <p
              className={cn(
                "mt-3 rounded-lg px-3 py-2 text-xs",
                isOverBooked
                  ? "bg-error-50 font-medium text-error-600"
                  : "bg-[#F8F8F8] text-black-300",
              )}
            >
              {isOverBooked
                ? `Over by ${formatPercent(remainingPercent.abs())}%. A stage cannot schedule more than 100% of its value — trim a line before saving.`
                : remainingPercent.isZero()
                  ? "Fully scheduled. Every part of this stage's value sits on a billing month."
                  : `${formatPercent(remainingPercent)}% (${formatCurrency(unscheduled.round().toNumber(), currency)}) is still unscheduled.`}
            </p>
          </section>

          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-black-200">
              Billing months
            </h3>
            <span className="text-[11px] text-black-200">% of stage value</span>
          </div>

          {draft.length === 0 ? (
            <EmptyState
              title="No billing months yet"
              description="Add the months this stage gets billed in and give each one its share of the stage value."
              className="py-2"
              action={
                canManage ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addLine}
                  >
                    Add month
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {draft.map((line, index) => (
                <ScheduleLineRow
                  key={line.key}
                  line={line}
                  index={index}
                  amount={(amounts[index] ?? Money.zero()).round().toNumber()}
                  currency={currency}
                  editable={canManage}
                  onChange={updateLine}
                  onRemove={removeLine}
                />
              ))}
            </ul>
          )}

          {canManage && draft.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={addLine}
            >
              Add month
            </Button>
          ) : null}

          <p className="mt-auto pt-2 text-[11px] text-black-200">
            These lines record billing that happened off-platform. BuildPanda
            never charges or moves money.
          </p>
        </>
      )}
    </FormDrawer>
  );
}

ScheduleOfValuesDrawer.displayName = "ScheduleOfValuesDrawer";

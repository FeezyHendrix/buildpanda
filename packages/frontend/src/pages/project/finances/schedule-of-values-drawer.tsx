import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
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
import { ScheduleSummary } from "./schedule-of-values-parts";

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
      submitLabel="Save Schedule"
      submitDisabled={!canSave}
      submitting={replace.isPending}
      error={replace.error ? getApiErrorMessage(replace.error) : null}
      onSubmit={handleSubmit}
      footerVariant="split"
      className="w-[min(592px,100vw)]"
      titleClassName="text-[20px] font-medium leading-[28px] tracking-normal"
      descriptionClassName="font-normal text-[#737373]"
      headerClassName="px-[24px] pb-[23px] pt-[39px]"
      bodyClassName="gap-0 px-[24px] py-0"
      footerClassName="gap-[8px] px-[24px] pb-[15px] pt-[16px] [&>button]:w-[179px]"
    >
      {isPending && !savedLines ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : (
        <>
          <hr className="border-0 border-t border-[#EEEEEE]" />
          <div className="mt-[24px]">
            <ScheduleSummary
              currency={currency}
              stageValue={stageValue}
              totalPercent={totalPercent}
              scheduledAmount={scheduledAmount}
              billedAmount={billedAmount}
              billedLines={billedLines}
              lineCount={draft.length}
              overBooked={isOverBooked}
              remainingPercent={remainingPercent}
              unscheduled={unscheduled}
            />
          </div>

          <hr className="mt-[23px] border-0 border-t border-[#EEEEEE]" />
          <h3 className="mt-[26px] text-[16px] font-medium leading-[20px] text-[#1E1E1E]">Billing Months</h3>

          {draft.length === 0 ? (
            <div className="mt-[26px]">
              <EmptyState
                variant="inline"
                title="No billing months yet"
                description="Add the months this stage gets billed in and give each one its share of the stage value."
                action={canManage ? { label: "Add month", onClick: addLine } : undefined}
              />
            </div>
          ) : (
            <ul className="mt-[26px] flex flex-col gap-[12px]">
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
            <button
              type="button"
              onClick={addLine}
              className="mt-[21px] inline-flex items-center gap-[10px] self-start pl-[19px] text-caption-l font-medium text-[#004DE7] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#004DE7]/25"
            >
              <Plus className="size-[16px]" strokeWidth={2} aria-hidden />
              Add Month
            </button>
          ) : null}

          <p className="mt-auto pb-[16px] pt-[24px] text-caption-m text-[#737373]">
            These lines record billing that happened off-platform. BuildPanda never charges or moves money.
          </p>
        </>
      )}
    </FormDrawer>
  );
}

ScheduleOfValuesDrawer.displayName = "ScheduleOfValuesDrawer";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { FormDrawer } from "@/components/molecules/form-drawer";
import {
  usePayApplication,
  useSetPayApplication,
  type PayApplicationLineInput,
} from "@/hooks/use-invoices";
import { useStages } from "@/hooks/use-stages";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/formatters";
import { Money } from "@/lib/money";
import type { Currency, Stage } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  PayApplicationLineRow,
  amountOrZero,
  isValidLine,
  lineTotals,
  nextPayLineKey,
  toDraftPayLine,
  type DraftPayLine,
} from "./pay-application-line";
import {
  CompletionBar,
  StagePicker,
  SummaryFigure,
  sharePercent,
} from "./pay-application-parts";

/**
 * Pay application editor for one progress invoice — an AIA G702/G703 sheet.
 *
 * A progress invoice bills build stages by period. Per stage the user records
 * what was completed THIS PERIOD, the materials PRESENTLY STORED and the amount
 * RETAINED; the backend derives what was billed in previous applications and
 * recomputes every total. Every figure here is a RECORDED position — BuildPanda
 * logs money movements that happened off-platform, it never bills, charges or
 * collects anything.
 *
 * Saving is a full replace: the rows on screen become the invoice's pay
 * application.
 */

interface PayApplicationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  invoiceId: string;
  /** Vendor / invoice number, for the drawer subtitle. */
  invoiceLabel: string;
  currency: Currency;
  canManage: boolean;
}

function toDraftFromStage(stage: Stage): DraftPayLine {
  return {
    key: nextPayLineKey(),
    stageId: stage.id,
    stageName: stage.name,
    scheduledValue: stage.value,
    priorBilled: 0,
    pendingPrior: true,
    thisPeriod: "",
    storedMaterials: "",
    retained: "",
  };
}

export function PayApplicationDrawer({
  open,
  onOpenChange,
  projectId,
  invoiceId,
  invoiceLabel,
  currency,
  canManage,
}: PayApplicationDrawerProps) {
  // Only reach for the sheet while the drawer is actually open — every invoice
  // card mounts one of these.
  const activeId = open ? invoiceId : undefined;
  const { data: summary, isPending } = usePayApplication(projectId, activeId);
  const { data: stages } = useStages(open ? projectId : undefined);
  const save = useSetPayApplication();

  const [draft, setDraft] = useState<DraftPayLine[]>([]);
  const [pickedStageId, setPickedStageId] = useState("");
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  const stageValueById = useMemo(
    () => new Map((stages ?? []).map((stage) => [stage.id, stage.value])),
    [stages],
  );

  // Seed the editable draft once per opening, then leave it alone so a
  // background refetch can never overwrite work in progress. The scheduled
  // value comes off the live stage, which is what the backend validates against.
  useEffect(() => {
    if (!open) {
      setHydratedFor(null);
      return;
    }
    if (!summary || !stages || hydratedFor === invoiceId) return;
    setDraft(
      summary.lines.map((line) =>
        toDraftPayLine(line, stageValueById.get(line.stageId) ?? line.scheduledValue),
      ),
    );
    setPickedStageId("");
    setHydratedFor(invoiceId);
  }, [open, invoiceId, summary, stages, stageValueById, hydratedFor]);

  const totals = useMemo(() => draft.map(lineTotals), [draft]);

  const thisPeriodTotal = useMemo(
    () => Money.sum(draft.map((line) => amountOrZero(line.thisPeriod))).round(2),
    [draft],
  );
  const storedTotal = useMemo(
    () => Money.sum(draft.map((line) => amountOrZero(line.storedMaterials))).round(2),
    [draft],
  );
  const retainedTotal = useMemo(
    () => Money.sum(draft.map((line) => amountOrZero(line.retained))).round(2),
    [draft],
  );
  const currentPaymentDue = useMemo(
    () => Money.sum(totals.map((total) => total.currentPaymentDue)).round(2),
    [totals],
  );
  const completedTotal = useMemo(
    () => Money.sum(totals.map((total) => total.totalCompleted)).round(2),
    [totals],
  );
  const balanceToFinish = useMemo(
    () => Money.sum(totals.map((total) => total.balanceToFinish)).round(2),
    [totals],
  );
  const priorTotal = useMemo(
    () => Money.sum(draft.map((line) => line.priorBilled)).round(2),
    [draft],
  );
  const contractSum = useMemo(
    () => Money.sum(draft.map((line) => line.scheduledValue)).round(2),
    [draft],
  );

  const overBilled = totals.filter((total) => total.overBilled).length;
  const invalidLines = draft.filter((line) => !isValidLine(line)).length;

  const isDirty = useMemo(() => {
    const saved = summary?.lines ?? [];
    if (saved.length !== draft.length) return true;
    return draft.some((line, index) => {
      const row = saved[index];
      if (!row) return true;
      return (
        row.stageId !== line.stageId ||
        !Money.of(row.thisPeriod).eq(amountOrZero(line.thisPeriod)) ||
        !Money.of(row.storedMaterials).eq(amountOrZero(line.storedMaterials)) ||
        !Money.of(row.retained).eq(amountOrZero(line.retained))
      );
    });
  }, [draft, summary]);

  const canSave =
    canManage && overBilled === 0 && invalidLines === 0 && isDirty;

  const availableStages = useMemo(() => {
    const taken = new Set(draft.map((line) => line.stageId));
    return (stages ?? []).filter((stage) => !taken.has(stage.id));
  }, [draft, stages]);

  const updateLine = useCallback(
    (key: string, patch: Partial<Omit<DraftPayLine, "key">>) => {
      setDraft((current) =>
        current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
      );
    },
    [],
  );

  const removeLine = useCallback((key: string) => {
    setDraft((current) => current.filter((line) => line.key !== key));
  }, []);

  const addStage = useCallback(() => {
    const stage = availableStages.find((item) => item.id === pickedStageId);
    if (!stage) return;
    setDraft((current) => [...current, toDraftFromStage(stage)]);
    setPickedStageId("");
  }, [availableStages, pickedStageId]);

  const handleSubmit = useCallback(() => {
    if (!canSave) return;
    const lines: PayApplicationLineInput[] = draft.map((line) => ({
      stageId: line.stageId,
      thisPeriod: amountOrZero(line.thisPeriod),
      storedMaterials: amountOrZero(line.storedMaterials),
      retained: amountOrZero(line.retained),
    }));
    save.mutate(
      { projectId, invoiceId, lines },
      {
        onSuccess: () => {
          toast("Pay application saved", "success");
          onOpenChange(false);
        },
      },
    );
  }, [canSave, draft, projectId, invoiceId, save, onOpenChange]);

  const hasStages = (stages ?? []).length > 0;
  const loading = isPending && !summary;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Pay application"
      description={`${invoiceLabel} · progress application against the build stages. Saving replaces every stage line on this invoice.`}
      submitLabel="Save application"
      submitDisabled={!canSave}
      submitting={save.isPending}
      error={save.error ? getApiErrorMessage(save.error) : null}
      onSubmit={handleSubmit}
      className="w-[min(680px,100vw)]"
    >
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : (
        <>
          <section className="sticky top-0 z-10 -mx-6 -mt-5 border-b border-grey-50 bg-white px-6 pb-4 pt-5">
            <div className="grid grid-cols-3 gap-4">
              <SummaryFigure
                label="This period"
                value={formatCurrency(thisPeriodTotal.toNumber(), currency)}
                caption={`+ ${formatCurrency(storedTotal.toNumber(), currency)} stored`}
              />
              <SummaryFigure
                label="Less retainage"
                value={formatCurrency(retainedTotal.toNumber(), currency)}
                caption={`${formatCurrency(priorTotal.toNumber(), currency)} billed before`}
              />
              <SummaryFigure
                label="Current payment due"
                value={formatCurrency(currentPaymentDue.toNumber(), currency)}
                caption={`${formatCurrency(balanceToFinish.toNumber(), currency)} to finish`}
                emphasis
                align="right"
              />
            </div>

            <CompletionBar
              priorShare={sharePercent(priorTotal, contractSum.toNumber())}
              completedShare={sharePercent(completedTotal, contractSum.toNumber())}
              overBilled={overBilled > 0}
              className="mt-3"
            />

            <p
              className={cn(
                "mt-3 rounded-lg px-3 py-2 text-xs",
                overBilled > 0
                  ? "bg-error-50 font-medium text-error-600"
                  : "bg-[#F8F8F8] text-black-300",
              )}
            >
              {overBilled > 0
                ? `${overBilled} ${overBilled === 1 ? "stage bills" : "stages bill"} past the scheduled value. A stage cannot be billed beyond its contract value — fix the flagged rows before saving.`
                : `${formatCurrency(completedTotal.toNumber(), currency)} completed and stored to date of ${formatCurrency(contractSum.toNumber(), currency)} on this application.`}
            </p>
          </section>

          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-black-200">
              Stages on this application
            </h3>
            <span className="text-[11px] text-black-200">
              {draft.length} {draft.length === 1 ? "stage" : "stages"}
            </span>
          </div>

          {!hasStages ? (
            <EmptyState
              title="No build stages yet"
              description="A progress application bills against build stages. Add stages to the contract first, then come back to record what was completed this period."
              className="py-2"
            />
          ) : draft.length === 0 ? (
            <EmptyState
              title="Nothing billed on this application"
              description="Put a build stage on the application, then record what was completed this period, what is stored on site, and what is being held back."
              className="py-2"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {draft.map((line, index) => (
                <PayApplicationLineRow
                  key={line.key}
                  line={line}
                  index={index}
                  totals={totals[index] ?? lineTotals(line)}
                  currency={currency}
                  editable={canManage}
                  onChange={updateLine}
                  onRemove={removeLine}
                />
              ))}
            </ul>
          )}

          {canManage && hasStages ? (
            <StagePicker
              options={availableStages}
              value={pickedStageId}
              onChange={setPickedStageId}
              onAdd={addStage}
            />
          ) : null}

          <p className="mt-auto pt-2 text-[11px] text-black-200">
            Billed in previous applications is derived from the other
            applications on each stage. These lines record billing that happened
            off-platform — BuildPanda never charges or moves money.
          </p>
        </>
      )}
    </FormDrawer>
  );
}

PayApplicationDrawer.displayName = "PayApplicationDrawer";

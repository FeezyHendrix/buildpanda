import { useCallback, useEffect, useState } from "react";
import { CurrencyAmountField, DRAWER_LABEL_CLASS } from "@/components/molecules/drawer-fields";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { useUpdateStage } from "@/hooks/use-stages";
import { getApiErrorMessage } from "@/lib/api-error";
import { currencySymbol, formatCurrency } from "@/lib/formatters";
import type { Currency, Stage } from "@/lib/project-types";
import { toast } from "@/lib/toast";

/**
 * Set the slice of the contract a single build stage carries. The value is a
 * recorded figure — it prices the stage for reporting and for the Schedule of
 * Values, it does not commit or move any money.
 */

interface StageValueDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  stage: Stage | null;
  currency: Currency;
}

export function StageValueDrawer({
  open,
  onOpenChange,
  projectId,
  stage,
  currency,
}: StageValueDrawerProps) {
  const update = useUpdateStage();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open || !stage) return;
    setValue(stage.value > 0 ? String(stage.value) : "");
  }, [open, stage]);

  const amount = Number(value);
  const isValid =
    value.trim().length > 0 && Number.isFinite(amount) && amount >= 0;
  const isChanged = stage ? amount !== stage.value : false;

  const handleSubmit = useCallback(() => {
    if (!stage || !isValid || !isChanged) return;
    update.mutate(
      { projectId, stageId: stage.id, value: amount },
      {
        onSuccess: () => {
          toast("Stage value updated", "success");
          onOpenChange(false);
        },
      },
    );
  }, [stage, isValid, isChanged, update, projectId, amount, onOpenChange]);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Set stage value"
      description={
        stage
          ? `${stage.name} — the share of the contract this stage carries.`
          : "The share of the contract a stage carries."
      }
      submitLabel="Save Value"
      submitDisabled={!isValid || !isChanged}
      submitting={update.isPending}
      error={update.error ? getApiErrorMessage(update.error) : null}
      onSubmit={handleSubmit}
      footerVariant="split"
      className="w-[min(592px,100vw)]"
      titleClassName="text-[20px] font-medium leading-[28px] tracking-normal"
      descriptionClassName="text-caption-m font-normal text-[#737373]"
      headerClassName="px-[24px] pb-[20px] pt-[39px]"
      bodyClassName="gap-[16px] px-[24px] py-0"
      footerClassName="gap-[8px] px-[24px] pb-[15px] pt-[16px] [&>button]:w-[179px]"
    >
      <div className="flex flex-col gap-[5px]">
        <label htmlFor="stage-value" className={DRAWER_LABEL_CLASS}>Total</label>
        <CurrencyAmountField
          id="stage-value"
          value={value}
          onChange={setValue}
          currency={currency}
          symbol={currencySymbol(currency)}
          autoFocus
        />
        <p className="mt-[2px] text-caption-m text-[#737373]">
          Current: <span className="tabular-nums">{formatCurrency(stage?.value ?? 0, currency)}</span>. Stage values have to stay
          within the project's contract sum.
        </p>
      </div>

      <p className="mt-[13px] bg-[#F6F6F6] px-[13px] py-[10px] text-caption-m text-[#737373]">
        Schedule of Values lines keep the amounts already recorded against them. Save the schedule again to re-price it against
        the new stage value.
      </p>
    </FormDrawer>
  );
}

StageValueDrawer.displayName = "StageValueDrawer";

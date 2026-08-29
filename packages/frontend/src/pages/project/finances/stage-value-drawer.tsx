import { useCallback, useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
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
      submitLabel="Save value"
      submitDisabled={!isValid || !isChanged}
      submitting={update.isPending}
      error={update.error ? getApiErrorMessage(update.error) : null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="stage-value">Scheduled value</Label>
        <MoneyInput
          id="stage-value"
          value={value}
          onChange={setValue}
          currencySymbol={currencySymbol(currency)}
          autoFocus
        />
        <p className="text-[11px] text-black-200">
          Current:{" "}
          <span className="font-medium tabular-nums text-black-300">
            {formatCurrency(stage?.value ?? 0, currency)}
          </span>
          . Stage values have to stay within the project's contract sum.
        </p>
      </div>

      <p className="rounded-lg bg-[#F8F8F8] px-3 py-2 text-[11px] text-black-300">
        Schedule of Values lines keep the amounts already recorded against them.
        Save the schedule again to re-price it against the new stage value.
      </p>
    </FormDrawer>
  );
}

StageValueDrawer.displayName = "StageValueDrawer";

import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { RecordVariationDialog } from "@/components/molecules/record-variation-dialog";
import { useUpdateContractTerms } from "@/hooks/use-finances";
import { getApiErrorMessage } from "@/lib/api-error";
import { currencySymbol as symbolFor, formatCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import type { Currency } from "@/lib/project-types";
import { cn } from "@/lib/utils";

export interface ContractOverviewCardProps {
  projectId: string;
  contractSum: number;
  variationsTotal: number;
  adjustedContract: number;
  certifiedGrossToDate: number;
  currency: Currency;
  canManage: boolean;
  className?: string;
}

function StatBlock({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: string;
  tone?: "muted" | "positive" | "negative" | "brand";
  className?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-rose-600"
        : tone === "brand"
          ? "text-[#004DE7]"
          : "text-gray-900";
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className={cn("text-lg font-bold tabular-nums", toneClass)}>
        {value}
      </span>
    </div>
  );
}

function EditContractSumDialog({
  open,
  onOpenChange,
  projectId,
  currentContractSum,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currentContractSum: number;
  currency: Currency;
}) {
  const update = useUpdateContractTerms();
  const [value, setValue] = useState(
    currentContractSum ? currentContractSum.toString() : "",
  );

  useEffect(() => {
    if (open) {
      setValue(currentContractSum ? currentContractSum.toString() : "");
    }
  }, [open, currentContractSum]);

  const amountNumber = Number(value);
  const isValid =
    value.trim().length > 0 &&
    Number.isFinite(amountNumber) &&
    amountNumber >= 0;
  const isChanged = amountNumber !== currentContractSum;

  function handleSubmit(): void {
    if (!isValid || !isChanged) return;
    update.mutate(
      { projectId, contractSum: amountNumber },
      {
        onSuccess: () => {
          toast("Contract sum updated", "success");
          onOpenChange(false);
        },
        onError: (err) => {
          toast(getApiErrorMessage(err), "error");
        },
      },
    );
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Set contract sum"
      description="The base contract value agreed with the contractor, before variations."
      submitLabel="Save"
      submitDisabled={!isValid || !isChanged}
      submitting={update.isPending}
      error={update.error ? getApiErrorMessage(update.error) : null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contract-sum-inline">Contract sum</Label>
        <MoneyInput
          id="contract-sum-inline"
          value={value}
          onChange={setValue}
          currencySymbol={symbolFor(currency)}
          autoFocus
        />
        <p className="text-[11px] text-gray-400">
          Current:{" "}
          <span className="tabular-nums font-medium text-gray-600">
            {formatCurrency(currentContractSum, currency)}
          </span>
          . Variations and certifications are unchanged.
        </p>
      </div>
    </FormDrawer>
  );
}

export function ContractOverviewCard({
  projectId,
  contractSum,
  variationsTotal,
  adjustedContract,
  certifiedGrossToDate,
  currency,
  canManage,
  className,
}: ContractOverviewCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [variationOpen, setVariationOpen] = useState(false);
  const percentCertified =
    adjustedContract > 0
      ? Math.min(100, Math.round((certifiedGrossToDate / adjustedContract) * 100))
      : 0;
  const variationTone = variationsTotal >= 0 ? "positive" : "negative";
  const variationValue = `${variationsTotal >= 0 ? "+" : "−"}${formatCurrency(
    Math.abs(variationsTotal),
    currency,
  )}`;

  return (
    <>
      <Card className={cn("mt-6 p-6", className)}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[13px] font-semibold text-black-300">Contract</h3>
            <p className="mt-1 text-xs text-gray-500">
              Base sum plus recorded variations. Certified is invoiced/valued work to date.
            </p>
          </div>
          {canManage && (
            <div className="flex flex-shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setVariationOpen(true)}
              >
                Record variation
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                {contractSum > 0 ? "Edit contract sum" : "Set contract sum"}
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <StatBlock
            label="Contract sum"
            value={formatCurrency(contractSum, currency)}
          />
          <StatBlock
            label="Variations"
            value={variationValue}
            tone={variationTone}
          />
          <StatBlock
            label="Adjusted contract"
            value={formatCurrency(adjustedContract, currency)}
            tone="brand"
          />
          <StatBlock
            label="Certified to date"
            value={formatCurrency(certifiedGrossToDate, currency)}
          />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Progress against adjusted contract</span>
            <span className="font-semibold text-gray-900 tabular-nums">
              {percentCertified}%
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[#004DE7] transition-[width] duration-300"
              style={{ width: `${percentCertified}%` }}
            />
          </div>
        </div>
      </Card>

      <EditContractSumDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        projectId={projectId}
        currentContractSum={contractSum}
        currency={currency}
      />
      <RecordVariationDialog
        open={variationOpen}
        onOpenChange={setVariationOpen}
        projectId={projectId}
        currency={currency}
        currentAdjustedContract={adjustedContract}
        currentVariationsTotal={variationsTotal}
      />
    </>
  );
}

import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { useRecordVariation } from "@/hooks/use-finances";
import { getApiErrorMessage } from "@/lib/api-error";
import { currencySymbol as symbolFor, formatCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import type { Currency } from "@/lib/project-types";
import { cn } from "@/lib/utils";

type Sign = "addition" | "omission";

interface RecordVariationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currency: Currency;
  currentAdjustedContract: number;
  currentVariationsTotal: number;
}

function SignToggle({
  value,
  onChange,
  disabled,
}: {
  value: Sign;
  onChange: (next: Sign) => void;
  disabled: boolean;
}) {
  const options: {
    key: Sign;
    label: string;
    hint: string;
    tone: "positive" | "negative";
  }[] = [
    {
      key: "addition",
      label: "Addition (+)",
      hint: "Increases the adjusted contract sum",
      tone: "positive",
    },
    {
      key: "omission",
      label: "Omission (−)",
      hint: "Decreases the adjusted contract sum",
      tone: "negative",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => {
        const selected = opt.key === value;
        const tone =
          opt.tone === "positive"
            ? selected
              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
              : "border-gray-200 text-gray-700 hover:border-gray-300"
            : selected
              ? "border-rose-500 bg-rose-50 text-rose-700"
              : "border-gray-200 text-gray-700 hover:border-gray-300";
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            disabled={disabled}
            className={cn(
              "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
              tone,
            )}
          >
            <span className="text-sm font-semibold">{opt.label}</span>
            <span className="text-xs text-gray-500">{opt.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

export function RecordVariationDialog({
  open,
  onOpenChange,
  projectId,
  currency,
  currentAdjustedContract,
  currentVariationsTotal,
}: RecordVariationDialogProps) {
  const record = useRecordVariation();
  const [sign, setSign] = useState<Sign>("addition");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setSign("addition");
      setAmount("");
      setDescription("");
    }
  }, [open]);

  const magnitude = Number(amount);
  const trimmedDescription = description.trim();
  const signedAmount = sign === "addition" ? magnitude : -magnitude;
  const isValid =
    amount.trim().length > 0 &&
    Number.isFinite(magnitude) &&
    magnitude > 0 &&
    trimmedDescription.length > 0;

  const preview = currentAdjustedContract + (isValid ? signedAmount : 0);
  const newVariationsTotal =
    currentVariationsTotal + (isValid ? signedAmount : 0);

  function handleSubmit(): void {
    if (!isValid) return;
    record.mutate(
      { projectId, amount: signedAmount, description: trimmedDescription },
      {
        onSuccess: () => {
          toast("Variation recorded", "success");
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
      title="Record variation"
      description="Log a change to the contract value. Positive for additional works, negative for omissions or descoped items."
      submitLabel={sign === "addition" ? "Add variation" : "Deduct variation"}
      submitDisabled={!isValid}
      submitting={record.isPending}
      error={record.error ? getApiErrorMessage(record.error) : null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Direction</Label>
          <SignToggle
            value={sign}
            onChange={setSign}
            disabled={record.isPending}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="variation-amount">Amount</Label>
          <MoneyInput
            id="variation-amount"
            value={amount}
            onChange={setAmount}
            currencySymbol={symbolFor(currency)}
            autoFocus
          />
          <p className="text-[11px] text-gray-400">
            Enter a positive number — the direction toggle above controls the
            sign. Adjusted contract will move to{" "}
            <span className="tabular-nums font-medium text-gray-600">
              {formatCurrency(preview, currency)}
            </span>
            . Variations total will be{" "}
            <span
              className={cn(
                "tabular-nums font-medium",
                newVariationsTotal >= 0 ? "text-emerald-600" : "text-rose-600",
              )}
            >
              {newVariationsTotal >= 0 ? "+" : "−"}
              {formatCurrency(Math.abs(newVariationsTotal), currency)}
            </span>
            .
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="variation-description">Description</Label>
          <textarea
            id="variation-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="e.g. Additional structural steel to accommodate revised roof design (RFI-042)"
            className="resize-none rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
          />
          <p className="text-[11px] text-gray-400">
            {trimmedDescription.length}/500 · required for the audit trail
          </p>
        </div>
      </div>
    </FormDrawer>
  );
}

import { useEffect, useState } from "react";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { useFundProject } from "@/hooks/use-finances";
import { errorMessage } from "@/lib/api-error";
import { currencySymbol } from "@/lib/formatters";
import { toast } from "@/lib/toast";

/**
 * Records money the client has put into the project. Funding is NOT
 * certification: it never moves the contract waterfall, it sits in its own
 * ledger, and like everything else here it logs a movement that happened
 * off-platform rather than making one.
 */
interface RecordDepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currency: string;
}

export function RecordDepositDialog({ open, onOpenChange, projectId, currency }: RecordDepositDialogProps) {
  const fund = useFundProject();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setDescription("");
    fund.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const parsed = Number(amount);
  const isValid = amount.trim().length > 0 && Number.isFinite(parsed) && parsed > 0;

  function handleSubmit(): void {
    if (!isValid) return;
    fund.mutate(
      { projectId, amount: parsed, description: description.trim() || undefined },
      {
        onSuccess: () => {
          toast("Funding recorded", "success");
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Record funding"
      description="Money the client has put into the project. This is funding, not certification — it does not change what has been certified or paid on the contract."
      submitLabel="Record funding"
      submitDisabled={!isValid}
      submitting={fund.isPending}
      error={fund.error ? errorMessage(fund.error) : null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="deposit-amount">Amount</Label>
        <MoneyInput
          id="deposit-amount"
          value={amount}
          onChange={setAmount}
          currencySymbol={currencySymbol(currency)}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="deposit-description">What this covers</Label>
        <input
          id="deposit-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="e.g. Mobilisation advance received 12 Sept"
          maxLength={200}
          className={INPUT_CLASS}
        />
      </div>
    </FormDrawer>
  );
}

RecordDepositDialog.displayName = "RecordDepositDialog";

import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { formatCurrency } from "@/lib/formatters";

interface FundProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { amount: number; description?: string }) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

function FundProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  error,
}: FundProjectDialogProps) {
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  useEffect(() => {
    if (!open) {
      setAmount("");
      setDescription("");
    }
  }, [open]);

  const parsed = Number(amount.replace(/[\s,]/g, ""));
  const isValid = Number.isFinite(parsed) && parsed > 0;
  const preview = isValid ? formatCurrency(parsed, "NGN") : null;

  function handleSubmit(): void {
    if (!isValid) return;
    const body: { amount: number; description?: string } = { amount: parsed };
    const trimmedDesc = description.trim();
    if (trimmedDesc) body.description = trimmedDesc;
    onSubmit(body);
  }

  return (
    <FormDrawer open={open}
    onOpenChange={onOpenChange}
    title="Fund Project"
    description="Top up the project escrow. The full amount becomes available for milestone releases."
    submitLabel="Fund Project"
    submitDisabled={!isValid}
    submitting={isSubmitting}
    error={error ?? null}
    onSubmit={handleSubmit}><div className="flex flex-col gap-1.5">
      <Label htmlFor="fund-amount">Amount (NGN)</Label>
      <input
        id="fund-amount"
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="5,000,000"
        autoFocus
        className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
      />
      {preview && (
        <p className="text-xs tabular-nums text-gray-500">{preview}</p>
      )}
    </div>
    
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="fund-description">Description (optional)</Label>
      <input
        id="fund-description"
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. Top-up funding for MEP phase"
        maxLength={200}
        className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
      />
    </div></FormDrawer>
  );
}

FundProjectDialog.displayName = "FundProjectDialog";

export { FundProjectDialog, type FundProjectDialogProps };

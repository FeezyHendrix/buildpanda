import type { ChangeEvent } from "react";
import { Label } from "@/components/atoms/label";
import { Spinner } from "@/components/atoms/spinner";
import { Switcher } from "@/components/atoms/switcher";

/**
 * The two flags that stop an expense being read as final cost.
 *
 * A CREDIT is a refund or credit note against the category — which is what a
 * negative amount was being used for, wrongly, until the API started refusing
 * one. A RECOVERABLE outlay (a plant-hire deposit, a bond) comes back at the
 * end of the job, so it must not sit in used cost for ever.
 */
export function ExpenseFlagFields({
  credit,
  recoverable,
  onCreditChange,
  onRecoverableChange,
}: {
  credit: boolean;
  recoverable: boolean;
  onCreditChange: (next: boolean) => void;
  onRecoverableChange: (next: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Credit / refund</Label>
        <Switcher value={credit ? "yes" : "no"} onChange={(next) => onCreditChange(next === "yes")} />
        <p className="text-xs text-ink-muted">
          Money coming back against this category — a refund or a supplier credit note, not an
          outlay.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Recoverable deposit</Label>
        <Switcher
          value={recoverable ? "yes" : "no"}
          onChange={(next) => onRecoverableChange(next === "yes")}
        />
        <p className="text-xs text-ink-muted">
          A deposit or bond you expect back — a plant-hire deposit is not final cost.
        </p>
      </div>
    </div>
  );
}

ExpenseFlagFields.displayName = "ExpenseFlagFields";

export function ExpenseReceiptField({
  receiptUrl,
  hasReceipt,
  uploadProgress,
  onClear,
  onPick,
}: {
  receiptUrl: string | null;
  hasReceipt: boolean;
  uploadProgress: number | null;
  onClear: () => void;
  onPick: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Receipt</Label>
      {hasReceipt && receiptUrl ? (
        <div className="relative inline-block overflow-hidden rounded-lg border border-line-hair">
          <img src={receiptUrl} alt="Receipt preview" className="h-24 w-auto bg-gray-50 object-cover" />
          <button
            type="button"
            aria-label="Remove receipt"
            className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-xs text-white hover:bg-black/70"
            onClick={onClear}
          >
            ×
          </button>
        </div>
      ) : uploadProgress !== null ? (
        <div className="flex h-[46px] items-center gap-3 rounded-lg border border-line bg-surface-alt px-4 text-sm text-ink-muted">
          <Spinner size="xs" />
          Uploading… {uploadProgress}%
        </div>
      ) : (
        <input
          type="file"
          accept="image/*,application/pdf"
          className="block w-full text-sm text-ink-muted file:mr-4 file:h-8 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:text-xs file:font-semibold file:text-ink hover:file:border-primary-500 hover:file:bg-primary-50 hover:file:text-primary-600"
          onChange={onPick}
        />
      )}
    </div>
  );
}

ExpenseReceiptField.displayName = "ExpenseReceiptField";

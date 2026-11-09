import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { ComboSelect } from "@/components/molecules/combo-select";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { currencySymbol } from "@/lib/formatters";
import type { MilestonePayment } from "@/lib/project-types";
import { type PaymentClaimStatus } from "@/hooks/use-payment-claims";
import { cn } from "@/lib/utils";
import { EMPTY, STATUSES, inputClass, type RequestValues } from "./payment-request-model";

export function UpsertRequestDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
  currency,
  milestones,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: RequestValues;
  onSubmit: (values: RequestValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
  currency: string;
  milestones: MilestonePayment[];
}) {
  const [values, setValues] = useState<RequestValues>(EMPTY);
  const symbol = currencySymbol(currency);
  const milestoneItems = useMemo(
    () => milestones.map((milestone) => ({ id: milestone.id, label: milestone.name })),
    [milestones],
  );

  useEffect(() => {
    if (open) setValues(initial ?? EMPTY);
  }, [open, initial]);

  function update<K extends keyof RequestValues>(key: K, value: RequestValues[K]): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const amountNumber = Number(values.amount);
  const isValid =
    values.claimNumber.trim().length > 0 &&
    values.amount.trim().length > 0 &&
    Number.isFinite(amountNumber) &&
    amountNumber >= 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      ...values,
      claimNumber: values.claimNumber.trim(),
      amount: String(amountNumber),
      notes: values.notes.trim(),
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "edit" ? "Edit payment request" : "New payment request"}
      description={
        mode === "edit"
          ? "Update this contractor payment request and its approval status."
          : "Record a contractor payment request for this project."
      }
      submitLabel={mode === "edit" ? "Save changes" : "Add request"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="request-number">Request number</Label>
        <input
          id="request-number"
          value={values.claimNumber}
          onChange={(e) => update("claimNumber", e.target.value)}
          placeholder="e.g. PR-0042"
          maxLength={100}
          autoFocus
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="request-milestone">Stage payment</Label>
        <ComboSelect
          items={milestoneItems}
          value={values.milestonePaymentId || null}
          onChange={(value) => update("milestonePaymentId", value ?? "")}
          placeholder="No stage payment linked"
          searchPlaceholder="Search stage payments…"
          emptyText="No stage payments available"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="request-amount">Amount</Label>
          <MoneyInput
            id="request-amount"
            value={values.amount}
            onChange={(v) => update("amount", v)}
            currencySymbol={symbol}
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="request-status">Status</Label>
          <select
            id="request-status"
            value={values.status}
            onChange={(e) => update("status", e.target.value as PaymentClaimStatus)}
            className={inputClass}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="request-period-start">Period start</Label>
          <input id="request-period-start" type="date" value={values.periodStart} onChange={(e) => update("periodStart", e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="request-period-end">Period end</Label>
          <input id="request-period-end" type="date" value={values.periodEnd} onChange={(e) => update("periodEnd", e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="request-submitted-at">Submitted at</Label>
          <input id="request-submitted-at" type="date" value={values.submittedAt} onChange={(e) => update("submittedAt", e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="request-approved-at">Approved at</Label>
          <input id="request-approved-at" type="date" value={values.approvedAt} onChange={(e) => update("approvedAt", e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="request-notes">Notes</Label>
        <textarea
          id="request-notes"
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Work completed, supporting evidence, or approval context…"
          maxLength={2000}
          rows={4}
          className={cn(inputClass, "h-auto py-3 resize-none")}
        />
      </div>
    </FormDrawer>
  );
}

UpsertRequestDialog.displayName = "UpsertRequestDialog";

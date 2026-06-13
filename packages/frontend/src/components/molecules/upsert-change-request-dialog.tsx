import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "./form-drawer";
import type { ChangeStatus } from "@/lib/project-types";

export interface UpsertChangeValues {
  title: string;
  description: string | null;
  reason: string | null;
  status: ChangeStatus;
  costImpact: number;
  timeImpactDays: number;
  currency: "NGN" | "USD";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Partial<UpsertChangeValues>;
  onSubmit: (values: UpsertChangeValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const STATUS: { value: ChangeStatus; label: string }[] = [
  { value: "Draft", label: "Draft" },
  { value: "Submitted", label: "Submitted" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

function UpsertChangeRequestDialog({ open, onOpenChange, mode, initial, onSubmit, isSubmitting = false, error }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<ChangeStatus>("Draft");
  const [cost, setCost] = useState("0");
  const [days, setDays] = useState("0");
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setReason(initial?.reason ?? "");
      setStatus(initial?.status ?? "Draft");
      setCost(String(initial?.costImpact ?? 0));
      setDays(String(initial?.timeImpactDays ?? 0));
      setCurrency(initial?.currency ?? "NGN");
    }
  }, [open, initial]);

  function handleSubmit(): void {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      reason: reason.trim() || null,
      status,
      costImpact: Number(cost) || 0,
      timeImpactDays: Math.round(Number(days) || 0),
      currency,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "New change request" : "Edit change request"}
      description="Propose a change to scope, cost or schedule."
      submitLabel={mode === "create" ? "Create" : "Save changes"}
      submitDisabled={!title.trim()}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cr-title">Title</Label>
        <input id="cr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Upgrade to imported floor tiles" className={field} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cr-desc">Details</Label>
        <textarea id="cr-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What's changing?" className="rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cr-reason">Reason</Label>
        <input id="cr-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is it needed?" className={field} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cr-currency">Currency</Label>
          <select id="cr-currency" value={currency} onChange={(e) => setCurrency(e.target.value as "NGN" | "USD")} className={field}>
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cr-cost">Cost impact</Label>
          <input id="cr-cost" type="number" value={cost} onChange={(e) => setCost(e.target.value)} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cr-days">Time (days)</Label>
          <input id="cr-days" type="number" value={days} onChange={(e) => setDays(e.target.value)} className={field} />
        </div>
      </div>
      {mode === "edit" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cr-status">Status</Label>
          <select id="cr-status" value={status} onChange={(e) => setStatus(e.target.value as ChangeStatus)} className={field}>
            {STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </FormDrawer>
  );
}

UpsertChangeRequestDialog.displayName = "UpsertChangeRequestDialog";

export { UpsertChangeRequestDialog };

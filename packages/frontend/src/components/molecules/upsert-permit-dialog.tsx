import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "./form-drawer";
import type { PermitStatus } from "@/lib/project-types";

export interface UpsertPermitValues {
  title: string;
  authority: string | null;
  referenceNo: string | null;
  status: PermitStatus;
  appliedDate: string | null;
  approvedDate: string | null;
  expiryDate: string | null;
  notes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Partial<UpsertPermitValues>;
  onSubmit: (values: UpsertPermitValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const STATUS: { value: PermitStatus; label: string }[] = [
  { value: "NotStarted", label: "Not started" },
  { value: "Applied", label: "Applied" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "Expired", label: "Expired" },
];

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

function UpsertPermitDialog({ open, onOpenChange, mode, initial, onSubmit, isSubmitting = false, error }: Props) {
  const [v, setV] = useState<UpsertPermitValues>({
    title: "", authority: "", referenceNo: "", status: "NotStarted", appliedDate: "", approvedDate: "", expiryDate: "", notes: "",
  });

  useEffect(() => {
    if (open) {
      setV({
        title: initial?.title ?? "",
        authority: initial?.authority ?? "",
        referenceNo: initial?.referenceNo ?? "",
        status: initial?.status ?? "NotStarted",
        appliedDate: initial?.appliedDate ?? "",
        approvedDate: initial?.approvedDate ?? "",
        expiryDate: initial?.expiryDate ?? "",
        notes: initial?.notes ?? "",
      });
    }
  }, [open, initial]);

  function set<K extends keyof UpsertPermitValues>(k: K, val: UpsertPermitValues[K]) {
    setV((prev) => ({ ...prev, [k]: val }));
  }

  function handleSubmit(): void {
    if (!v.title.trim()) return;
    onSubmit({
      title: v.title.trim(),
      authority: (v.authority || "").trim() || null,
      referenceNo: (v.referenceNo || "").trim() || null,
      status: v.status,
      appliedDate: v.appliedDate || null,
      approvedDate: v.approvedDate || null,
      expiryDate: v.expiryDate || null,
      notes: (v.notes || "").trim() || null,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Add permit / approval" : "Edit permit"}
      description="Track a regulatory permit or government approval."
      submitLabel={mode === "create" ? "Add" : "Save changes"}
      submitDisabled={!v.title.trim()}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pm-title">Title</Label>
        <input id="pm-title" value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Building permit" className={field} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pm-auth">Authority</Label>
          <input id="pm-auth" value={v.authority ?? ""} onChange={(e) => set("authority", e.target.value)} placeholder="e.g. LASBCA" className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pm-ref">Reference no.</Label>
          <input id="pm-ref" value={v.referenceNo ?? ""} onChange={(e) => set("referenceNo", e.target.value)} className={field} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pm-status">Status</Label>
        <select id="pm-status" value={v.status} onChange={(e) => set("status", e.target.value as PermitStatus)} className={field}>
          {STATUS.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pm-applied">Applied</Label>
          <input id="pm-applied" type="date" value={v.appliedDate ?? ""} onChange={(e) => set("appliedDate", e.target.value)} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pm-approved">Approved</Label>
          <input id="pm-approved" type="date" value={v.approvedDate ?? ""} onChange={(e) => set("approvedDate", e.target.value)} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pm-expiry">Expires</Label>
          <input id="pm-expiry" type="date" value={v.expiryDate ?? ""} onChange={(e) => set("expiryDate", e.target.value)} className={field} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pm-notes">Notes</Label>
        <textarea id="pm-notes" value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2} className="rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10" />
      </div>
    </FormDrawer>
  );
}

UpsertPermitDialog.displayName = "UpsertPermitDialog";

export { UpsertPermitDialog };

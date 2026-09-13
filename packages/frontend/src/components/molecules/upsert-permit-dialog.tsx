import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "./form-drawer";
import type { PermitStatus, ProjectDocument } from "@/lib/project-types";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

export interface UpsertPermitValues {
  title: string;
  authority: string | null;
  referenceNo: string | null;
  status?: PermitStatus;
  appliedDate: string | null;
  approvedDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  documentId: string | null;
  conditions: string | null;
  responsiblePerson: string | null;
  renewalSubmittedAt: string | null;
  leadTimeDays: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Partial<UpsertPermitValues>;
  /** The register, so the instrument itself can be attached (finding #7). */
  documents?: ProjectDocument[];
  onSubmit: (values: UpsertPermitValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const field = INPUT_CLASS;

const EMPTY: UpsertPermitValues = {
  title: "",
  authority: "",
  referenceNo: "",
  appliedDate: "",
  approvedDate: "",
  expiryDate: "",
  notes: "",
  documentId: null,
  conditions: "",
  responsiblePerson: "",
  renewalSubmittedAt: "",
  leadTimeDays: null,
};

function UpsertPermitDialog({
  open,
  onOpenChange,
  mode,
  initial,
  documents = [],
  onSubmit,
  isSubmitting = false,
  error,
}: Props) {
  const [v, setV] = useState<UpsertPermitValues>(EMPTY);

  useEffect(() => {
    if (open) {
      setV({
        ...EMPTY,
        title: initial?.title ?? "",
        authority: initial?.authority ?? "",
        referenceNo: initial?.referenceNo ?? "",
        appliedDate: initial?.appliedDate ?? "",
        approvedDate: initial?.approvedDate ?? "",
        expiryDate: initial?.expiryDate ?? "",
        notes: initial?.notes ?? "",
        documentId: initial?.documentId ?? null,
        conditions: initial?.conditions ?? "",
        responsiblePerson: initial?.responsiblePerson ?? "",
        renewalSubmittedAt: initial?.renewalSubmittedAt ?? "",
        leadTimeDays: initial?.leadTimeDays ?? null,
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
      appliedDate: v.appliedDate || null,
      approvedDate: v.approvedDate || null,
      expiryDate: v.expiryDate || null,
      notes: (v.notes || "").trim() || null,
      documentId: v.documentId || null,
      conditions: (v.conditions || "").trim() || null,
      responsiblePerson: (v.responsiblePerson || "").trim() || null,
      renewalSubmittedAt: v.renewalSubmittedAt || null,
      leadTimeDays: v.leadTimeDays ?? null,
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
      <div className="flex flex-col gap-4">
        <h4 className="text-sm font-semibold text-gray-900">Permit</h4>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pm-title">Title *</Label>
          <input id="pm-title" value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Foundation Permit" className={field} autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pm-auth">Authority</Label>
          <input id="pm-auth" value={v.authority ?? ""} onChange={(e) => set("authority", e.target.value)} placeholder="e.g. LASBCA" className={field} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pm-ref">Reference no.</Label>
            <input id="pm-ref" value={v.referenceNo ?? ""} onChange={(e) => set("referenceNo", e.target.value)} className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pm-owner">Responsible person</Label>
            <input
              id="pm-owner"
              value={v.responsiblePerson ?? ""}
              onChange={(e) => set("responsiblePerson", e.target.value)}
              maxLength={200}
              placeholder="Who chases the renewal?"
              className={field}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pm-document">Attached instrument</Label>
          <select
            id="pm-document"
            value={v.documentId ?? ""}
            onChange={(e) => set("documentId", e.target.value || null)}
            className={field}
          >
            <option value="">Not attached</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title ?? doc.fileName}
                {doc.revision ? ` · ${doc.revision}` : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            The permit document itself, from the project's documents register.
          </p>
        </div>
      </div>

      <hr className="my-6 border-line-hair" />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold text-gray-900">Dates</h4>
          <p className="text-xs text-gray-500">Status is set automatically from these dates.</p>
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
      </div>

      <hr className="my-6 border-line-hair" />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold text-gray-900">Renewal</h4>
          <p className="text-xs text-gray-500">
            "Expired with a renewal lodged" is a different risk from "expired, nothing done".
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pm-renewal">Renewal submitted</Label>
            <input
              id="pm-renewal"
              type="date"
              value={v.renewalSubmittedAt ?? ""}
              onChange={(e) => set("renewalSubmittedAt", e.target.value)}
              className={field}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pm-lead">Renewal lead time (days)</Label>
            <input
              id="pm-lead"
              type="number"
              min={0}
              max={365}
              value={v.leadTimeDays ?? ""}
              onChange={(e) => set("leadTimeDays", e.target.value === "" ? null : Number(e.target.value))}
              placeholder="e.g. 42"
              className={field}
            />
            <p className="text-xs text-gray-500">
              How long this authority takes. The expiry warning starts this far out.
            </p>
          </div>
        </div>
      </div>

      <hr className="my-6 border-line-hair" />

      <div className="flex flex-col gap-4">
        <h4 className="text-sm font-semibold text-gray-900">Conditions</h4>
        <div className="flex flex-col gap-1.5">
          <textarea
            id="pm-conditions"
            value={v.conditions ?? ""}
            onChange={(e) => set("conditions", e.target.value)}
            rows={3}
            maxLength={4000}
            className={cn(INPUT_CLASS, "h-auto min-h-24 py-3 lg:text-sm")}
            placeholder="e.g. Single-lane working 22:00–05:00 only; 3.0 m lane width; TM signage to LASTMA drawing 4b."
          />
          <p className="text-xs text-gray-500">
            The conditions attached to the permit. Breaching them invalidates it.
          </p>
        </div>
      </div>

      <hr className="my-6 border-line-hair" />

      <div className="flex flex-col gap-4">
        <h4 className="text-sm font-semibold text-gray-900">Notes</h4>
        <div className="flex flex-col gap-1.5">
          <textarea id="pm-notes" value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} className={cn(INPUT_CLASS, "h-auto min-h-24 py-3 lg:text-sm")} placeholder="Add any additional details here..." />
        </div>
      </div>
    </FormDrawer>
  );
}

UpsertPermitDialog.displayName = "UpsertPermitDialog";

export { UpsertPermitDialog };

import { useEffect, useState, type ReactNode } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { Switcher } from "@/components/atoms/switcher";
import type { Supplier, SupplierScope } from "@/lib/project-types";
import type { SupplierInput } from "@/hooks/use-suppliers";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

const FIELD = INPUT_CLASS;

const SCOPE_OPTIONS: readonly { value: SupplierScope; label: string; helper: string }[] = [
  {
    value: "organization",
    label: "Workspace",
    helper: "A company account you buy from on every job.",
  },
  {
    value: "project",
    label: "This project",
    helper: "A supplier raised for this job alone.",
  },
] as const;

interface UpsertSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Supplier | null;
  onSubmit: (values: SupplierInput) => void;
  isSubmitting?: boolean;
  error?: string | null;
  /** Rendered above the fields — the duplicate warning lives here. */
  banner?: ReactNode;
  /** Sent as `force` so a flagged duplicate can be saved deliberately. */
  force?: boolean;
  className?: string;
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={FIELD}
      />
    </div>
  );
}

function UpsertSupplierDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
  banner,
  force = false,
  className,
}: UpsertSupplierDialogProps) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [trade, setTrade] = useState("");
  const [approved, setApproved] = useState(false);
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [scope, setScope] = useState<SupplierScope>("organization");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setContactName(initial?.contactName ?? "");
    setEmail(initial?.email ?? "");
    setPhone(initial?.phone ?? "");
    setAddress(initial?.address ?? "");
    setTrade(initial?.trade ?? "");
    setApproved(initial?.approved ?? false);
    setLeadTimeDays(initial?.leadTimeDays === null || initial?.leadTimeDays === undefined ? "" : String(initial.leadTimeDays));
    setPaymentTerms(initial?.paymentTerms ?? "");
    setScope(initial?.scope ?? "organization");
    setNotes(initial?.notes ?? "");
  }, [open, initial]);

  const isValid = name.trim().length > 0;
  const leadTime = leadTimeDays.trim() === "" ? null : Number(leadTimeDays);

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      name: name.trim(),
      contactName: contactName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      trade: trade.trim() || null,
      approved,
      leadTimeDays: leadTime !== null && Number.isFinite(leadTime) ? Math.round(leadTime) : null,
      paymentTerms: paymentTerms.trim() || null,
      notes: notes.trim() || null,
      // Scope is fixed at creation — a shared account cannot become a local one.
      ...(initial ? {} : { scope }),
      ...(force ? { force: true } : {}),
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit supplier" : "Add supplier"}
      description="The register is what orders point at, so the trade and terms belong here rather than in a note."
      submitLabel={force ? "Add anyway" : initial ? "Save changes" : "Add supplier"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
      className={className}
    >
      {banner}

      <Field
        id="supplier-name"
        label="Supplier name"
        value={name}
        onChange={setName}
        placeholder="e.g. Ogun Quarries Ltd"
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          id="supplier-trade"
          label="Trade"
          value={trade}
          onChange={setTrade}
          placeholder="Aggregates, cement, steel, fuel…"
        />
        <Field
          id="supplier-contact"
          label="Contact person"
          value={contactName}
          onChange={setContactName}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field id="supplier-email" label="Email" type="email" value={email} onChange={setEmail} />
        <Field id="supplier-phone" label="Phone" value={phone} onChange={setPhone} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          id="supplier-lead-time"
          label="Lead time (days)"
          type="number"
          value={leadTimeDays}
          onChange={setLeadTimeDays}
          placeholder="e.g. 14"
        />
        <Field
          id="supplier-terms"
          label="Payment terms"
          value={paymentTerms}
          onChange={setPaymentTerms}
          placeholder="30 days net, on delivery…"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="supplier-approved">On the approved-supplier list</Label>
        <Switcher
          value={approved ? "yes" : "no"}
          onChange={(next) => setApproved(next === "yes")}
        />
        <p className="text-xs text-ink-muted">
          Approved suppliers sort to the top of every order picker.
        </p>
      </div>

      {initial ? null : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="supplier-scope">Scope</Label>
          <select
            id="supplier-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as SupplierScope)}
            className={FIELD}
          >
            {SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-muted">
            {SCOPE_OPTIONS.find((option) => option.value === scope)?.helper}
          </p>
        </div>
      )}

      <Field id="supplier-address" label="Address" value={address} onChange={setAddress} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="supplier-notes">Notes</Label>
        <textarea
          id="supplier-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={cn(INPUT_CLASS, "h-auto min-h-24 py-3")}
        />
      </div>
    </FormDrawer>
  );
}

UpsertSupplierDialog.displayName = "UpsertSupplierDialog";

export { UpsertSupplierDialog };

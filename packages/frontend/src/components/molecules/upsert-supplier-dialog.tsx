import { useEffect, useState, type ReactNode } from "react";
import { FormDrawer } from "./form-drawer";
import { TextArea } from "@/components/atoms/text-area";
import { TextInput } from "@/components/atoms/text-input";
import type { Supplier } from "@/lib/project-types";
import type { SupplierInput } from "@/hooks/use-suppliers";

interface UpsertSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Supplier | null;
  onSubmit: (values: SupplierInput) => void;
  isSubmitting?: boolean;
  error?: string | null;
  onDelete?: () => void;
  /** Rendered above the fields — the duplicate warning lives here. */
  banner?: ReactNode;
  /** Sent as `force` so a flagged duplicate can be saved deliberately. */
  force?: boolean;
  className?: string;
}

function UpsertSupplierDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
  onDelete,
  banner,
  force = false,
  className,
}: UpsertSupplierDialogProps) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setContactName(initial?.contactName ?? "");
    setEmail(initial?.email ?? "");
    setPhone(initial?.phone ?? "");
    setAddress(initial?.address ?? "");
    setNotes(initial?.notes ?? "");
  }, [open, initial]);

  const isValid = name.trim().length > 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      name: name.trim(),
      contactName: contactName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      ...(force ? { force: true } : {}),
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit Supplier" : "Add Supplier"}
      submitLabel={force ? "Add anyway" : initial ? "Save changes" : "Add Supplier"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
      footerVariant="stacked"
      className={className}
    >
      {banner}
      <TextInput
        label="Supplier Name"
        value={name}
        onChange={setName}
        placeholder="e.g ABUTECH Ventures"
        autoFocus
      />

      <TextInput
        label="Contact Person"
        value={contactName}
        onChange={setContactName}
      />

      <div className="grid grid-cols-2 gap-3">
        <TextInput
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="off"
        />
        <TextInput
          label="Phone Number"
          value={phone}
          onChange={setPhone}
          autoComplete="off"
        />
      </div>

      <TextInput label="Address" value={address} onChange={setAddress} />

      <TextArea label="Notes" value={notes} onChange={setNotes} rows={5} />

      {initial && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="self-start text-sm font-medium text-[#E7000B] outline-none hover:text-[#A30006]"
        >
          Delete supplier
        </button>
      )}
    </FormDrawer>
  );
}

export { UpsertSupplierDialog };

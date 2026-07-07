import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import type { Supplier } from "@/lib/project-types";
import type { SupplierInput } from "@/hooks/use-suppliers";

const FIELD =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

interface UpsertSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Supplier | null;
  onSubmit: (values: SupplierInput) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

function UpsertSupplierDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
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
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit supplier" : "Add supplier"}
      submitLabel={initial ? "Save changes" : "Add supplier"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="supplier-name">Supplier name</Label>
        <input
          id="supplier-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Lagos Cement Supplies"
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="supplier-contact">Contact person</Label>
        <input
          id="supplier-contact"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          className={FIELD}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="supplier-email">Email</Label>
          <input
            id="supplier-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="supplier-phone">Phone</Label>
          <input
            id="supplier-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={FIELD}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="supplier-address">Address</Label>
        <input
          id="supplier-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="supplier-notes">Notes</Label>
        <textarea
          id="supplier-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
    </FormDrawer>
  );
}

export { UpsertSupplierDialog };

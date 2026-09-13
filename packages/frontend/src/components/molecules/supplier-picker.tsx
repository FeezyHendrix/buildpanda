import { useMemo, useState } from "react";
import { Label } from "@/components/atoms/label";
import { ComboSelect, type ComboItem } from "@/components/molecules/combo-select";
import { UpsertSupplierDialog } from "@/components/molecules/upsert-supplier-dialog";
import { useCreateSupplier, useSuppliers, type SupplierInput } from "@/hooks/use-suppliers";
import { errorMessage } from "@/lib/api-error";
import type { Supplier } from "@/lib/project-types";

const NO_SUPPLIER = "__none__";
const ADD_SUPPLIER = "__add__";

/**
 * Supplier is a reference, not typed text: an order points at a register row so
 * the contact, the trade and the spend against that account all hang together.
 * "Add new" stays inline because a QS meets a new supplier mid-order.
 */
interface SupplierPickerProps {
  projectId: string;
  /** Only fetch the register while the host drawer is open. */
  enabled: boolean;
  value: string | null;
  /** The row is handed back too, for forms that also store the supplier's name. */
  onChange: (supplierId: string | null, supplier: Supplier | null) => void;
  /** Free-text supplier from before the register existed, shown as a fallback. */
  legacyName?: string | null;
  id?: string;
  label?: string;
}

function toItems(suppliers: readonly Supplier[]): ComboItem[] {
  const approved = suppliers.filter((supplier) => supplier.approved);
  const rest = suppliers.filter((supplier) => !supplier.approved);
  const row = (supplier: Supplier): ComboItem => ({
    id: supplier.id,
    label: supplier.name,
    group: supplier.trade ?? undefined,
  });
  return [
    { id: NO_SUPPLIER, label: "No supplier yet" },
    ...approved.map(row),
    ...rest.map(row),
    { id: ADD_SUPPLIER, label: "＋ Add a new supplier…" },
  ];
}

export function SupplierPicker({
  projectId,
  enabled,
  value,
  onChange,
  legacyName,
  id = "supplier-picker",
  label = "Supplier",
}: SupplierPickerProps) {
  const { data: suppliers = [] } = useSuppliers(enabled ? projectId : undefined);
  const createSupplier = useCreateSupplier();
  const [addOpen, setAddOpen] = useState(false);

  const items = useMemo(() => toItems(suppliers), [suppliers]);
  const selected = suppliers.find((supplier) => supplier.id === value) ?? null;

  function handleChange(next: string | null): void {
    if (next === ADD_SUPPLIER) {
      setAddOpen(true);
      return;
    }
    const id = next && next !== NO_SUPPLIER ? next : null;
    onChange(id, suppliers.find((supplier) => supplier.id === id) ?? null);
  }

  function handleCreate(values: SupplierInput): void {
    createSupplier.mutate(
      { projectId, ...values },
      {
        onSuccess: (supplier) => {
          setAddOpen(false);
          onChange(supplier.id, supplier);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <ComboSelect
        items={items}
        value={value ?? NO_SUPPLIER}
        onChange={handleChange}
        placeholder="Pick from the supplier register"
        searchPlaceholder="Search suppliers…"
        emptyText="No suppliers on the register"
        id={id}
      />
      {selected ? (
        <p className="text-xs text-ink-muted">
          {selected.approved ? "Approved supplier" : "Not on the approved list"}
          {selected.leadTimeDays !== null ? ` · ${selected.leadTimeDays} day lead time` : ""}
          {selected.paymentTerms ? ` · ${selected.paymentTerms}` : ""}
        </p>
      ) : legacyName ? (
        <p className="text-xs text-ink-muted">
          Recorded as free text: “{legacyName}”. Pick the register row to link it.
        </p>
      ) : null}

      {addOpen ? (
        <UpsertSupplierDialog
          open
          onOpenChange={setAddOpen}
          onSubmit={handleCreate}
          isSubmitting={createSupplier.isPending}
          error={createSupplier.error ? errorMessage(createSupplier.error) : null}
          className="z-[60]"
        />
      ) : null}
    </div>
  );
}

SupplierPicker.displayName = "SupplierPicker";

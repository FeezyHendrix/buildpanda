import { useMemo, useState } from "react";
import { Label } from "@/components/atoms/label";
import { SearchableSelect } from "@/components/atoms/searchable-select";
import { UpsertSupplierDialog } from "@/components/molecules/upsert-supplier-dialog";
import { useCreateSupplier, useSuppliers, type SupplierInput } from "@/hooks/use-suppliers";
import { errorMessage } from "@/lib/api-error";
import type { Supplier } from "@/lib/project-types";
import { cn } from "@/lib/utils";

const NO_SUPPLIER_LABEL = "No supplier yet";

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
  /** Style hooks for forms whose design departs from the default field look. */
  className?: string;
  labelClassName?: string;
  triggerClassName?: string;
  triggerIconClassName?: string;
}

/** Approved suppliers first, then the rest; the "no supplier" row leads. */
function toLabels(suppliers: readonly Supplier[]): string[] {
  const approved = suppliers.filter((supplier) => supplier.approved);
  const rest = suppliers.filter((supplier) => !supplier.approved);
  return [NO_SUPPLIER_LABEL, ...approved.map((supplier) => supplier.name), ...rest.map((supplier) => supplier.name)];
}

export function SupplierPicker({
  projectId,
  enabled,
  value,
  onChange,
  legacyName,
  id = "supplier-picker",
  label = "Supplier",
  className,
  labelClassName,
  triggerClassName,
  triggerIconClassName,
}: SupplierPickerProps) {
  const { data: suppliers = [] } = useSuppliers(enabled ? projectId : undefined);
  const createSupplier = useCreateSupplier();
  const [addOpen, setAddOpen] = useState(false);

  const items = useMemo(() => toLabels(suppliers), [suppliers]);
  const selected = suppliers.find((supplier) => supplier.id === value) ?? null;

  function handleChange(next: string | null): void {
    const row = next && next !== NO_SUPPLIER_LABEL ? (suppliers.find((supplier) => supplier.name === next) ?? null) : null;
    onChange(row?.id ?? null, row);
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
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className={labelClassName}>{label}</Label>
      <SearchableSelect
        id={id}
        items={items}
        value={selected?.name ?? NO_SUPPLIER_LABEL}
        onChange={handleChange}
        searchPlaceholder="Search suppliers"
        emptyText="No suppliers on the register"
        className={triggerClassName}
        iconClassName={triggerIconClassName}
        footerAction={{ label: "Add a new supplier", onSelect: () => setAddOpen(true) }}
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

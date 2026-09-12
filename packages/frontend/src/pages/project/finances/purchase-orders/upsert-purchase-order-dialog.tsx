import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { ComboSelect, type ComboItem } from "@/components/molecules/combo-select";
import { FormDrawer } from "@/components/molecules/form-drawer";
import type { PurchaseOrderStatus } from "@/hooks/use-purchase-orders";
import { useStages } from "@/hooks/use-stages";
import type { Stage } from "@/lib/project-types";
import { currencySymbol, formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  EMPTY_PO,
  PO_STATUSES,
  isLineValid,
  lineTotal,
  poInputClass,
  type LineItemValues,
  type UpsertPurchaseOrderValues,
} from "./purchase-order-model";
import { PoMetric } from "./po-metric";

const NO_STAGE = "__none__";

function toStageItems(stages: Stage[]): ComboItem[] {
  return [{ id: NO_STAGE, label: "No stage" }, ...stages.map((s) => ({ id: s.id, label: s.name }))];
}

interface UpsertPurchaseOrderDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: UpsertPurchaseOrderValues;
  onSubmit: (values: UpsertPurchaseOrderValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
  currency: string;
}

function LineItemRow({
  item,
  index,
  currency,
  canRemove,
  onChange,
  onRemove,
}: {
  item: LineItemValues;
  index: number;
  currency: string;
  canRemove: boolean;
  onChange: (index: number, patch: Partial<LineItemValues>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="grid gap-2 rounded-xl bg-[#FAFAFA] p-3 sm:grid-cols-[1fr_88px_132px_112px_auto] sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`po-item-description-${index}`}>Description</Label>
        <input
          id={`po-item-description-${index}`}
          value={item.description}
          onChange={(event) => onChange(index, { description: event.target.value })}
          placeholder="e.g. Cement bags"
          maxLength={500}
          className={poInputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`po-item-quantity-${index}`}>Qty</Label>
        <input
          id={`po-item-quantity-${index}`}
          type="number"
          inputMode="decimal"
          min={0.01}
          step="0.01"
          value={item.quantity}
          onChange={(event) => onChange(index, { quantity: event.target.value })}
          className={poInputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`po-item-unit-price-${index}`}>Unit price</Label>
        <MoneyInput
          id={`po-item-unit-price-${index}`}
          value={item.unitPrice}
          onChange={(value) => onChange(index, { unitPrice: value })}
          currencySymbol={currencySymbol(currency)}
          placeholder="0.00"
        />
      </div>
      <PoMetric label="Line total" value={formatCurrency(lineTotal(item), currency)} accent />
      <Button type="button" variant="ghost" size="sm" disabled={!canRemove} onClick={() => onRemove(index)}>
        Remove
      </Button>
    </div>
  );
}

export function UpsertPurchaseOrderDialog({
  projectId,
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
  currency,
}: UpsertPurchaseOrderDialogProps) {
  const [values, setValues] = useState<UpsertPurchaseOrderValues>(EMPTY_PO);
  const { data: stages = [] } = useStages(open ? projectId : undefined);
  const stageItems = useMemo(() => toStageItems(stages), [stages]);

  useEffect(() => {
    if (open) setValues(initial ?? EMPTY_PO);
  }, [open, initial]);

  function update<K extends keyof UpsertPurchaseOrderValues>(key: K, value: UpsertPurchaseOrderValues[K]): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateItem(index: number, patch: Partial<LineItemValues>): void {
    setValues((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  function addItem(): void {
    setValues((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: "1", unitPrice: "" }],
    }));
  }

  function removeItem(index: number): void {
    setValues((prev) => ({
      ...prev,
      items: prev.items.filter((_item, itemIndex) => itemIndex !== index),
    }));
  }

  const grandTotal = values.items.reduce((sum, item) => sum + lineTotal(item), 0);
  const isValid =
    values.poNumber.trim().length > 0 &&
    values.vendorName.trim().length > 0 &&
    values.items.length > 0 &&
    values.items.every(isLineValid);

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      poNumber: values.poNumber.trim(),
      vendorName: values.vendorName.trim(),
      status: values.status,
      orderDate: values.orderDate.trim(),
      expectedDate: values.expectedDate.trim(),
      notes: values.notes.trim(),
      stageId: values.stageId,
      items: values.items.map((item) => ({
        description: item.description.trim(),
        quantity: String(Number(item.quantity || "1")),
        unitPrice: String(Number(item.unitPrice || "0")),
      })),
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "edit" ? "Edit purchase order" : "New purchase order"}
      description={
        mode === "edit"
          ? "Update the vendor PO and replace its line items."
          : "Create a vendor purchase order with committed line-item spend."
      }
      submitLabel={mode === "edit" ? "Save changes" : "Add purchase order"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
      className="w-[min(720px,100vw)]"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-number">PO number</Label>
          <input
            id="po-number"
            value={values.poNumber}
            onChange={(event) => update("poNumber", event.target.value)}
            placeholder="e.g. PO-0042"
            maxLength={100}
            autoFocus
            className={poInputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-vendor">Vendor name</Label>
          <input
            id="po-vendor"
            value={values.vendorName}
            onChange={(event) => update("vendorName", event.target.value)}
            placeholder="e.g. Adeyemi Builders Ltd"
            maxLength={200}
            className={poInputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-status">Status</Label>
          <select
            id="po-status"
            value={values.status}
            onChange={(event) => update("status", event.target.value as PurchaseOrderStatus)}
            className={poInputClass}
          >
            {PO_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-order-date">Order date</Label>
          <input
            id="po-order-date"
            type="date"
            value={values.orderDate}
            onChange={(event) => update("orderDate", event.target.value)}
            className={poInputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-expected-date">Expected date</Label>
          <input
            id="po-expected-date"
            type="date"
            value={values.expectedDate}
            onChange={(event) => update("expectedDate", event.target.value)}
            className={poInputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="po-stage">Stage</Label>
        <ComboSelect
          items={stageItems}
          value={values.stageId || NO_STAGE}
          onChange={(val) => update("stageId", val && val !== NO_STAGE ? val : "")}
          placeholder="Attribute to a build stage"
        />
        <p className="text-xs text-gray-500">Issued POs count as committed cost for this stage.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#F0F0F0] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Line items</p>
            <p className="text-xs text-gray-500">Quantity × unit price becomes committed spend.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addItem}>
            Add line
          </Button>
        </div>
        {values.items.map((item, index) => (
          <LineItemRow
            key={index}
            item={item}
            index={index}
            currency={currency}
            canRemove={values.items.length > 1}
            onChange={updateItem}
            onRemove={removeItem}
          />
        ))}
        <div className="flex justify-end border-t border-[#F0F0F0] pt-3">
          <PoMetric label="Grand total" value={formatCurrency(grandTotal, currency)} accent />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="po-notes">Notes</Label>
        <textarea
          id="po-notes"
          value={values.notes}
          onChange={(event) => update("notes", event.target.value)}
          placeholder="Delivery terms, approvals, or procurement context…"
          maxLength={2000}
          rows={4}
          className={cn(poInputClass, "h-auto py-3 resize-none")}
        />
      </div>
    </FormDrawer>
  );
}

UpsertPurchaseOrderDialog.displayName = "UpsertPurchaseOrderDialog";

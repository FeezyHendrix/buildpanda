import { useEffect, useMemo, useState } from "react";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { FinancesIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { Spinner } from "@/components/atoms/spinner";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { EmptyState } from "@/components/molecules/empty-state";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { PageHeader } from "@/components/molecules/page-header";
import {
  useCreatePurchaseOrder,
  useDeletePurchaseOrder,
  usePurchaseOrders,
  useUpdatePurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderInput,
  type PurchaseOrderStatus,
} from "@/hooks/use-purchase-orders";
import { useProjectContext } from "@/layouts/project-layout";
import { currencySymbol, formatCurrency } from "@/lib/formatters";
import { canResourceAction } from "@/lib/project-types";
import { cn } from "@/lib/utils";

const STATUSES: PurchaseOrderStatus[] = [
  "Draft",
  "Issued",
  "PartiallyReceived",
  "Received",
  "Closed",
  "Cancelled",
];

const STATUS_TONE: Record<PurchaseOrderStatus, BadgeTone> = {
  Draft: "neutral",
  Issued: "info",
  PartiallyReceived: "warning",
  Received: "accent",
  Closed: "success",
  Cancelled: "danger",
};

const inputClass =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";

interface LineItemValues {
  description: string;
  quantity: string;
  unitPrice: string;
}

interface UpsertPurchaseOrderValues {
  poNumber: string;
  vendorName: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate: string;
  notes: string;
  items: LineItemValues[];
}

const EMPTY: UpsertPurchaseOrderValues = {
  poNumber: "",
  vendorName: "",
  status: "Draft",
  orderDate: "",
  expectedDate: "",
  notes: "",
  items: [{ description: "", quantity: "1", unitPrice: "" }],
};

function lineTotal(item: LineItemValues): number {
  const quantity = Number(item.quantity || "0");
  const unitPrice = Number(item.unitPrice || "0");
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0;
  return Math.round(quantity * unitPrice * 100) / 100;
}

function toInput(values: UpsertPurchaseOrderValues): PurchaseOrderInput {
  return {
    poNumber: values.poNumber,
    vendorName: values.vendorName,
    status: values.status,
    orderDate: values.orderDate || undefined,
    expectedDate: values.expectedDate || undefined,
    notes: values.notes || undefined,
    items: values.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity || "1"),
      unitPrice: Number(item.unitPrice || "0"),
    })),
  };
}

function toValues(purchaseOrder: PurchaseOrder): UpsertPurchaseOrderValues {
  return {
    poNumber: purchaseOrder.poNumber,
    vendorName: purchaseOrder.vendorName,
    status: purchaseOrder.status,
    orderDate: purchaseOrder.orderDate ?? "",
    expectedDate: purchaseOrder.expectedDate ?? "",
    notes: purchaseOrder.notes ?? "",
    items: purchaseOrder.items.map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    })),
  };
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          accent ? "text-[#004DE7]" : "text-gray-900",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function UpsertPurchaseOrderDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: UpsertPurchaseOrderValues;
  onSubmit: (values: UpsertPurchaseOrderValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
  currency: string;
}) {
  const [values, setValues] = useState<UpsertPurchaseOrderValues>(EMPTY);
  const symbol = currencySymbol(currency);

  useEffect(() => {
    if (open) setValues(initial ?? EMPTY);
  }, [open, initial]);

  function update<K extends keyof UpsertPurchaseOrderValues>(
    key: K,
    value: UpsertPurchaseOrderValues[K],
  ): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateItem(index: number, patch: Partial<LineItemValues>): void {
    setValues((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
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
    values.items.every((item) => {
      const quantity = Number(item.quantity || "0");
      const unitPrice = Number(item.unitPrice || "0");
      return (
        item.description.trim().length > 0 &&
        Number.isFinite(quantity) &&
        quantity > 0 &&
        Number.isFinite(unitPrice) &&
        unitPrice >= 0
      );
    });

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      poNumber: values.poNumber.trim(),
      vendorName: values.vendorName.trim(),
      status: values.status,
      orderDate: values.orderDate.trim(),
      expectedDate: values.expectedDate.trim(),
      notes: values.notes.trim(),
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
            className={inputClass}
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
            className={inputClass}
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
            className={inputClass}
          >
            {STATUSES.map((status) => (
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
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-expected-date">Expected date</Label>
          <input
            id="po-expected-date"
            type="date"
            value={values.expectedDate}
            onChange={(event) => update("expectedDate", event.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#F0F0F0] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Line items</p>
            <p className="text-xs text-gray-500">
              Quantity × unit price becomes committed spend.
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addItem}>
            Add line
          </Button>
        </div>
        {values.items.map((item, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-xl bg-[#FAFAFA] p-3 sm:grid-cols-[1fr_88px_132px_112px_auto] sm:items-end"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`po-item-description-${index}`}>Description</Label>
              <input
                id={`po-item-description-${index}`}
                value={item.description}
                onChange={(event) => updateItem(index, { description: event.target.value })}
                placeholder="e.g. Cement bags"
                maxLength={500}
                className={inputClass}
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
                onChange={(event) => updateItem(index, { quantity: event.target.value })}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`po-item-unit-price-${index}`}>Unit price</Label>
              <MoneyInput
                id={`po-item-unit-price-${index}`}
                value={item.unitPrice}
                onChange={(value) => updateItem(index, { unitPrice: value })}
                currencySymbol={symbol}
                placeholder="0.00"
              />
            </div>
            <Metric label="Line total" value={formatCurrency(lineTotal(item), currency)} accent />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={values.items.length === 1}
              onClick={() => removeItem(index)}
            >
              Remove
            </Button>
          </div>
        ))}
        <div className="flex justify-end border-t border-[#F0F0F0] pt-3">
          <Metric label="Grand total" value={formatCurrency(grandTotal, currency)} accent />
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
          className={cn(inputClass, "h-auto py-3 resize-none")}
        />
      </div>
    </FormDrawer>
  );
}

function PurchaseOrderCard({
  purchaseOrder,
  projectId,
  currency,
  canManage,
}: {
  purchaseOrder: PurchaseOrder;
  projectId: string;
  currency: string;
  canManage: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const updatePurchaseOrder = useUpdatePurchaseOrder();
  const deletePurchaseOrder = useDeletePurchaseOrder();

  function handleEdit(values: UpsertPurchaseOrderValues): void {
    updatePurchaseOrder.mutate(
      { projectId, purchaseOrderId: purchaseOrder.id, ...toInput(values) },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-gray-900">
              {purchaseOrder.vendorName}
            </p>
            <Badge tone={STATUS_TONE[purchaseOrder.status]} size="md">
              {purchaseOrder.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {purchaseOrder.poNumber}
            {purchaseOrder.orderDate ? ` · Ordered ${purchaseOrder.orderDate}` : ""}
            {purchaseOrder.expectedDate ? ` · Expected ${purchaseOrder.expectedDate}` : ""}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>Delete</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Committed spend" value={formatCurrency(purchaseOrder.total, currency)} accent />
        <Metric label="Line items" value={String(purchaseOrder.items.length)} />
        <Metric label="Status" value={purchaseOrder.status} />
      </div>

      {purchaseOrder.notes && (
        <p className="text-sm text-gray-600 text-pretty">{purchaseOrder.notes}</p>
      )}

      <div className="flex flex-col gap-2 border-t border-[#F0F0F0] pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Line items
        </p>
        {purchaseOrder.items.map((item) => (
          <div
            key={item.id}
            className="grid gap-2 rounded-xl bg-[#FAFAFA] px-3 py-2 text-sm sm:grid-cols-[1fr_96px_132px_132px] sm:items-center"
          >
            <span className="font-medium text-gray-900">{item.description}</span>
            <span className="text-gray-500 tabular-nums">Qty {item.quantity}</span>
            <span className="text-gray-500 tabular-nums">
              {formatCurrency(item.unitPrice, currency)}
            </span>
            <span className="font-semibold text-gray-900 tabular-nums sm:text-right">
              {formatCurrency(item.lineTotal, currency)}
            </span>
          </div>
        ))}
      </div>

      <UpsertPurchaseOrderDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={toValues(purchaseOrder)}
        onSubmit={handleEdit}
        isSubmitting={updatePurchaseOrder.isPending}
        error={(updatePurchaseOrder.error as Error | undefined)?.message ?? null}
        currency={currency}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete purchase order?"
        description="This will remove the PO and all of its line items. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deletePurchaseOrder.isPending}
        onConfirm={() =>
          deletePurchaseOrder.mutate(
            { projectId, purchaseOrderId: purchaseOrder.id },
            { onSuccess: () => setDeleteOpen(false) },
          )
        }
      />
    </Card>
  );
}

export default function ProjectPurchaseOrders() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const currency = project.currency;
  const { data: purchaseOrders = [], isPending } = usePurchaseOrders(project.id);
  const createPurchaseOrder = useCreatePurchaseOrder();
  const [createOpen, setCreateOpen] = useState(false);

  const summary = useMemo(() => {
    return purchaseOrders.reduce(
      (acc, purchaseOrder) => {
        acc.committed += purchaseOrder.total;
        if (purchaseOrder.status === "Issued" || purchaseOrder.status === "PartiallyReceived") {
          acc.open += purchaseOrder.total;
        }
        if (purchaseOrder.status === "Received" || purchaseOrder.status === "Closed") {
          acc.received += purchaseOrder.total;
        }
        return acc;
      },
      { committed: 0, open: 0, received: 0 },
    );
  }, [purchaseOrders]);

  function handleCreate(values: UpsertPurchaseOrderValues): void {
    createPurchaseOrder.mutate(
      { projectId: project.id, ...toInput(values) },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Finances", to: `/project/${project.id}/finances` },
          { label: "Purchase Orders" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Purchase Orders"
        description="Track vendor POs, line items, and committed spend before invoice capture."
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4" />
              New purchase order
            </Button>
          ) : undefined
        }
      />

      <UpsertPurchaseOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createPurchaseOrder.isPending}
        error={(createPurchaseOrder.error as Error | undefined)?.message ?? null}
        currency={currency}
      />

      <section aria-label="Purchase order summary" className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card padding="md">
          <Metric label="Committed Spend" value={formatCurrency(summary.committed, currency)} accent />
        </Card>
        <Card padding="md">
          <Metric label="Open POs" value={formatCurrency(summary.open, currency)} />
        </Card>
        <Card padding="md">
          <Metric label="Received / Closed" value={formatCurrency(summary.received, currency)} />
        </Card>
      </section>

      <section className="mt-6">
        {isPending ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : purchaseOrders.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              icon={<FinancesIcon className="size-6" />}
              title="No purchase orders yet"
              description="Create vendor POs with line items to track committed spend before invoices arrive."
              action={
                canManage ? (
                  <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
                    <PlusIcon className="size-4" />
                    New purchase order
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4">
            {purchaseOrders.map((purchaseOrder) => (
              <PurchaseOrderCard
                key={purchaseOrder.id}
                purchaseOrder={purchaseOrder}
                projectId={project.id}
                currency={currency}
                canManage={canManage}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SearchableSelect } from "@/components/atoms/searchable-select";
import { DRAWER_FIELD_CLASS, DRAWER_LABEL_CLASS } from "@/components/molecules/drawer-fields";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { SupplierPicker } from "@/components/molecules/supplier-picker";
import { useStages } from "@/hooks/use-stages";
import { cn } from "@/lib/utils";
import { EMPTY_LINE, EMPTY_PO, isLineValid, type LineItemValues, type UpsertPurchaseOrderValues } from "./purchase-order-model";
import { AddImageButton, FileLink, LinesHeading, PO_HEADER_RULED, PO_SHEET, SheetRule } from "./po-parts";
import { PoLineEditor } from "./po-line-editor";

const NO_STAGE_LABEL = "No stage yet";
/** The design's selects carry a dark rule; the plain fields keep the light one. */
const SELECT_TRIGGER = "h-[45px] rounded-none border border-[#525252] bg-white px-[16px] text-caption-l text-[#1E1E1E]";
const CHEVRON_CLASS = "text-[#A3A3A3]";

function Field({ label, htmlFor, optional, children, className }: { label: string; htmlFor?: string; optional?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-[5px]", className)}>
      <label htmlFor={htmlFor} className={DRAWER_LABEL_CLASS}>
        {label}
        {optional ? <span className="font-normal text-[#737373]"> (optional)</span> : null}
      </label>
      {children}
    </div>
  );
}

Field.displayName = "Field";

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

/**
 * New and edit share one sheet. A PO starts as a draft; issuing it is what
 * makes it committed spend. Unit and images are picked but not sent: the API
 * has no field for them yet (docs/purchase-orders-backend.md).
 */
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
  const stageItems = useMemo(() => [NO_STAGE_LABEL, ...stages.map((stage) => stage.name)], [stages]);
  const stageName = stages.find((stage) => stage.id === values.stageId)?.name ?? NO_STAGE_LABEL;

  useEffect(() => {
    if (open) setValues(initial ?? EMPTY_PO);
  }, [open, initial]);

  function update<K extends keyof UpsertPurchaseOrderValues>(key: K, value: UpsertPurchaseOrderValues[K]): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateItem(index: number, patch: Partial<LineItemValues>): void {
    setValues((prev) => ({ ...prev, items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));
  }

  const isValid = values.vendorName.trim().length > 0 && values.items.length > 0 && values.items.every(isLineValid);

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      ...values,
      poNumber: values.poNumber.trim(),
      vendorName: values.vendorName.trim(),
      orderDate: values.orderDate.trim(),
      expectedDate: values.expectedDate.trim(),
      notes: values.notes.trim(),
      items: values.items.map((item) => ({
        ...item,
        description: item.description.trim(),
        quantity: String(Number(item.quantity || "1")),
        unitPrice: String(Number(item.unitPrice || "0")),
      })),
    });
  }

  const isEdit = mode === "edit";

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit purchase order" : "New purchase order"}
      description={
        isEdit
          ? "Update the vendor PO and replace its line items. A received PO's lines are fixed."
          : "A purchase order starts as a draft. Issuing it is what makes it committed spend."
      }
      submitLabel={isEdit ? "Save Changes" : "Add Purchase Order"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
      footerVariant="split"
      headerClassName={PO_HEADER_RULED}
      {...PO_SHEET}
    >
      <SheetRule />

      <div className="grid gap-x-[16px] gap-y-[24px] sm:grid-cols-2">
        <Field label="PO number" htmlFor="po-number">
          <input
            id="po-number"
            value={values.poNumber}
            onChange={(event) => update("poNumber", event.target.value)}
            placeholder="Leave blank to number it automatically"
            maxLength={100}
            autoFocus
            className={DRAWER_FIELD_CLASS}
          />
          <p className="mt-[3px] text-caption-m text-[#737373]">Blank numbers sequence as PO-1, PO-2… per project.</p>
        </Field>
        <Field label="Vendor name" htmlFor="po-vendor">
          <input
            id="po-vendor"
            value={values.vendorName}
            onChange={(event) => update("vendorName", event.target.value)}
            placeholder="e.g. BRIMATEL Ventures"
            maxLength={200}
            className={DRAWER_FIELD_CLASS}
          />
        </Field>
      </div>

      <SupplierPicker
        className="mt-[3px] gap-[5px]"
        labelClassName={DRAWER_LABEL_CLASS}
        triggerClassName={SELECT_TRIGGER}
        triggerIconClassName={CHEVRON_CLASS}
        projectId={projectId}
        enabled={open}
        value={values.supplierId}
        onChange={(supplierId, supplier) =>
          // The vendor line on the PO follows the register row it points at.
          setValues((prev) => ({ ...prev, supplierId, vendorName: supplier ? supplier.name : prev.vendorName }))
        }
        id="po-supplier"
        label="Supplier"
      />

      <div className="grid gap-x-[16px] gap-y-[24px] sm:grid-cols-2">
        <Field label="Order date" htmlFor="po-order-date">
          <input id="po-order-date" type="date" value={values.orderDate} onChange={(event) => update("orderDate", event.target.value)} className={DRAWER_FIELD_CLASS} />
        </Field>
        <Field label="Expected date" htmlFor="po-expected-date">
          <input id="po-expected-date" type="date" value={values.expectedDate} onChange={(event) => update("expectedDate", event.target.value)} className={DRAWER_FIELD_CLASS} />
        </Field>
      </div>

      <Field label="Stage" htmlFor="po-stage" className="-mt-[1px]">
        <SearchableSelect
          id="po-stage"
          items={stageItems}
          value={stageName}
          onChange={(name) => update("stageId", stages.find((stage) => stage.name === name)?.id ?? "")}
          placeholder="Attribute to a build stage"
          searchPlaceholder="Search stages"
          className={SELECT_TRIGGER}
          iconClassName={CHEVRON_CLASS}
        />
      </Field>

      <section className="mr-[16px] flex flex-col gap-[16px]">
        <LinesHeading
          hint="Each line is quantity × rate. Add as many as you need."
          action={
            <button
              type="button"
              onClick={() => update("items", [...values.items, EMPTY_LINE])}
              className="mt-[2px] text-caption-l font-semibold text-[#004DE7] outline-none hover:underline focus-visible:underline"
            >
              + Add line
            </button>
          }
        />
        <PoLineEditor
          items={values.items}
          currency={currency}
          onChange={updateItem}
          onRemove={(index) => update("items", values.items.filter((_, i) => i !== index))}
        />
      </section>

      <div className="mr-[16px] flex flex-col gap-[16px]">
        <Field label="Notes" htmlFor="po-notes" optional>
          <textarea
            id="po-notes"
            value={values.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Delivery terms, approvals, or procurement context…"
            maxLength={2000}
            className={cn(DRAWER_FIELD_CLASS, "h-[132px] resize-none py-[16px]")}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[8px]">
          <AddImageButton onFiles={(files) => update("images", [...values.images, ...files])} />
          {values.images.map((file, index) => (
            <FileLink key={`${file.name}-${index}`} file={file} onRemove={() => update("images", values.images.filter((_, i) => i !== index))} />
          ))}
        </div>
      </div>
    </FormDrawer>
  );
}

UpsertPurchaseOrderDialog.displayName = "UpsertPurchaseOrderDialog";

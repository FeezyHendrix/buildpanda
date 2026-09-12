import { useEffect, useMemo, useState } from "react";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { Spinner } from "@/components/atoms/spinner";
import { ComboSelect, type ComboItem } from "@/components/molecules/combo-select";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { useStages } from "@/hooks/use-stages";
import { useCreateTransaction, useUpdateTransaction } from "@/hooks/use-transactions";
import { useUploadFile, resolveFileUrl } from "@/hooks/use-files";
import { currencySymbol } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type {
  CreateTransactionInput,
  Stage,
  Transaction,
  TransactionCategoryInfo,
} from "@/lib/project-types";

export const expenseInputClass = INPUT_CLASS;
const textareaClass = cn(INPUT_CLASS, "h-auto min-h-24 resize-y py-3");

interface TransactionFormValues {
  title: string;
  description: string;
  category: string;
  amount: string;
  transactedAt: string;
  vendor: string;
  reference: string;
  receiptFileId: string;
  stageId: string;
}

const NO_STAGE = "__none__";

const EMPTY_FORM: TransactionFormValues = {
  title: "",
  description: "",
  category: "",
  amount: "",
  transactedAt: new Date().toISOString().split("T")[0]!,
  vendor: "",
  reference: "",
  receiptFileId: "",
  stageId: "",
};

export function CategoryBadge({ categoryLabel, categoryColor }: { categoryLabel: string; categoryColor: string | null }) {
  const hex = categoryColor || "#6B7280";
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
      style={{ backgroundColor: `${hex}26`, color: hex }}
    >
      {categoryLabel}
    </span>
  );
}

CategoryBadge.displayName = "CategoryBadge";

export function toStageItems(stages: Stage[]): ComboItem[] {
  return [
    { id: NO_STAGE, label: "No stage" },
    ...stages.map((s) => ({ id: s.id, label: s.name })),
  ];
}

export function toCategoryItems(categories: TransactionCategoryInfo[]): ComboItem[] {
  return categories.map((c) => ({
    id: c.key,
    label: c.label,
    group: c.type === "preset" ? "Presets" : "Custom",
  }));
}

export function UpsertTransactionDialog({
  projectId,
  currency,
  initial,
  categories,
  onClose,
  onManageCategories,
}: {
  projectId: string;
  currency: string;
  initial?: Transaction | null;
  categories: TransactionCategoryInfo[];
  onClose: () => void;
  onManageCategories: () => void;
}) {
  const isEdit = Boolean(initial);
  const [values, setValues] = useState<TransactionFormValues>(() => {
    if (!initial) return { ...EMPTY_FORM };
    return {
      title: initial.title,
      description: initial.description ?? "",
      category: initial.category,
      amount: initial.amount.toString(),
      transactedAt: initial.transactedAt.split("T")[0] || "",
      vendor: initial.vendor ?? "",
      reference: initial.reference ?? "",
      receiptFileId: initial.receiptFileId ?? "",
      stageId: initial.stageId ?? "",
    };
  });
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const create = useCreateTransaction(projectId);
  const update = useUpdateTransaction(projectId);
  const uploadFile = useUploadFile();
  const { data: stages = [] } = useStages(projectId);
  const stageItems = useMemo(() => toStageItems(stages), [stages]);
  const mutation = isEdit ? update : create;

  useEffect(() => {
    if (initial?.receiptFileId) {
      resolveFileUrl(initial.receiptFileId).then(setReceiptUrl).catch(() => {});
    }
  }, [initial?.receiptFileId]);

  const categoryItems = useMemo(() => {
    const items = toCategoryItems(categories);
    items.push({ id: "__manage__", label: "+ New category…", group: "Actions" });
    return items;
  }, [categories]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProgress(0);
    try {
      const res = await uploadFile.mutateAsync({ file, projectId, onProgress: setUploadProgress });
      setValues((prev) => ({ ...prev, receiptFileId: res.id }));
      const url = await resolveFileUrl(res.id);
      setReceiptUrl(url);
    } catch (err) {
      console.error(err);
    } finally {
      setUploadProgress(null);
    }
  }

  function handleSubmit() {
    const payload: CreateTransactionInput = {
      title: values.title,
      description: values.description || null,
      category: values.category,
      amount: Number(values.amount),
      transactedAt: values.transactedAt,
      vendor: values.vendor || null,
      reference: values.reference || null,
      receiptFileId: values.receiptFileId || null,
      stageId: values.stageId || null,
    };

    if (isEdit && initial) {
      update.mutate({ transactionId: initial.id, body: payload }, { onSuccess: onClose });
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  }

  const isValid = values.title && values.category && values.amount && values.transactedAt;

  return (
    <FormDrawer
      open
      onOpenChange={(open) => !open && onClose()}
      title={isEdit ? "Edit expense" : "Record expense"}
      submitLabel={isEdit ? "Save changes" : "Save entry"}
      submitting={mutation.isPending || uploadProgress !== null}
      submitDisabled={!isValid || uploadProgress !== null}
      error={mutation.error?.message}
      onSubmit={handleSubmit}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Title *</Label>
          <input
            className={expenseInputClass}
            value={values.title}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
            placeholder="e.g. Concrete mix"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Amount *</Label>
            <MoneyInput
              value={values.amount}
              onChange={(raw) => setValues({ ...values, amount: raw })}
              currencySymbol={currencySymbol(currency)}
            />
          </div>
          <div className="space-y-2">
            <Label>Date *</Label>
            <input
              type="date"
              className={expenseInputClass}
              value={values.transactedAt}
              onChange={(e) => setValues({ ...values, transactedAt: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Category *</Label>
          <ComboSelect
            items={categoryItems}
            value={values.category}
            onChange={(val) => {
              if (val === "__manage__") {
                onManageCategories();
              } else if (val) {
                setValues({ ...values, category: val });
              }
            }}
            placeholder="Select category"
          />
        </div>

        <div className="space-y-2">
          <Label>Stage</Label>
          <ComboSelect
            items={stageItems}
            value={values.stageId || NO_STAGE}
            onChange={(val) => setValues({ ...values, stageId: val && val !== NO_STAGE ? val : "" })}
            placeholder="Attribute to a build stage"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Vendor</Label>
            <input
              className={expenseInputClass}
              value={values.vendor}
              onChange={(e) => setValues({ ...values, vendor: e.target.value })}
              placeholder="e.g. BuildMart"
            />
          </div>
          <div className="space-y-2">
            <Label>Reference / Invoice #</Label>
            <input
              className={expenseInputClass}
              value={values.reference}
              onChange={(e) => setValues({ ...values, reference: e.target.value })}
              placeholder="e.g. INV-1234"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <textarea
            className={textareaClass}
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
            placeholder="Additional details..."
          />
        </div>

        <div className="space-y-2">
          <Label>Receipt</Label>
          {values.receiptFileId && receiptUrl ? (
            <div className="relative inline-block border rounded-lg overflow-hidden border-line-hair">
              <img src={receiptUrl} alt="Receipt preview" className="h-24 w-auto object-cover bg-gray-50" />
              <button
                type="button"
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 text-xs hover:bg-black/70"
                onClick={() => {
                  setValues({ ...values, receiptFileId: "" });
                  setReceiptUrl(null);
                }}
              >
                ×
              </button>
            </div>
          ) : uploadProgress !== null ? (
            <div className="flex items-center gap-3 h-[46px] px-4 rounded-lg border border-line bg-surface-alt text-sm text-ink-muted">
              <Spinner size="xs" />
              Uploading... {uploadProgress}%
            </div>
          ) : (
            <input
              type="file"
              accept="image/*,application/pdf"
              className="block w-full text-sm text-ink-muted file:mr-4 file:h-8 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:text-xs file:font-semibold file:text-ink hover:file:border-primary-500 hover:file:bg-primary-50 hover:file:text-primary-600"
              onChange={handleFile}
            />
          )}
        </div>
      </div>
    </FormDrawer>
  );
}

UpsertTransactionDialog.displayName = "UpsertTransactionDialog";

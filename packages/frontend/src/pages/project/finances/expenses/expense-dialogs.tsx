import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { Spinner } from "@/components/atoms/spinner";
import { ComboSelect, type ComboItem } from "@/components/molecules/combo-select";
import { FormDrawer } from "@/components/molecules/form-drawer";
import {
  useCreateTransaction,
  useCreateTransactionCategory,
  useDeleteTransactionCategory,
  useUpdateTransaction,
} from "@/hooks/use-transactions";
import { useUploadFile, resolveFileUrl } from "@/hooks/use-files";
import { currencySymbol } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type {
  CreateTransactionInput,
  Transaction,
  TransactionCategoryInfo,
} from "@/lib/project-types";

export const expenseInputClass =
  "flex h-11 w-full rounded-lg bg-[#F6F6F6] px-4 font-sans text-base lg:text-sm text-gray-900 border-0 outline-none ring-0 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-50";
const textareaClass =
  "flex w-full rounded-lg bg-[#F6F6F6] p-4 font-sans text-base lg:text-sm text-gray-900 border-0 outline-none ring-0 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px] resize-y";

const SWATCHES = [
  "#10B981", "#3B82F6", "#6366F1", "#8B5CF6",
  "#EC4899", "#F43F5E", "#F59E0B", "#F97316",
];

interface TransactionFormValues {
  title: string;
  description: string;
  category: string;
  amount: string;
  transactedAt: string;
  vendor: string;
  reference: string;
  receiptFileId: string;
}

const EMPTY_FORM: TransactionFormValues = {
  title: "",
  description: "",
  category: "",
  amount: "",
  transactedAt: new Date().toISOString().split("T")[0]!,
  vendor: "",
  reference: "",
  receiptFileId: "",
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
    };
  });
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const create = useCreateTransaction(projectId);
  const update = useUpdateTransaction(projectId);
  const uploadFile = useUploadFile();
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
            <div className="relative inline-block border rounded-lg overflow-hidden border-gray-200">
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
            <div className="flex items-center gap-3 h-11 px-4 rounded-lg bg-[#F6F6F6] text-sm text-gray-500">
              <Spinner size="xs" />
              Uploading... {uploadProgress}%
            </div>
          ) : (
            <input
              type="file"
              accept="image/*,application/pdf"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              onChange={handleFile}
            />
          )}
        </div>
      </div>
    </FormDrawer>
  );
}

UpsertTransactionDialog.displayName = "UpsertTransactionDialog";

export function ManageCategoriesDialog({
  projectId,
  categories,
  onClose,
}: {
  projectId: string;
  categories: TransactionCategoryInfo[];
  onClose: () => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(SWATCHES[0]!);
  const [deleteTarget, setDeleteTarget] = useState<TransactionCategoryInfo | null>(null);

  const create = useCreateTransactionCategory(projectId);
  const remove = useDeleteTransactionCategory(projectId);

  function handleCreate() {
    if (!newLabel.trim()) return;
    create.mutate({ label: newLabel, color: newColor }, { onSuccess: () => setNewLabel("") });
  }

  return (
    <>
      <FormDrawer
        open
        onOpenChange={(open) => !open && onClose()}
        title="Manage Categories"
        submitLabel="Done"
        onSubmit={onClose}
      >
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">Custom Categories</h4>
            <div className="flex gap-2 items-center">
              <input
                className={cn(expenseInputClass, "flex-1")}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Category name"
              />
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-11 w-11 p-1 rounded bg-[#F6F6F6] border-0 cursor-pointer"
              />
              <Button onClick={handleCreate} disabled={!newLabel.trim() || create.isPending}>
                Add
              </Button>
            </div>
          </div>

          <ul className="divide-y divide-gray-100 border-t border-gray-100">
            {categories.map((c) => (
              <li key={c.key} className="flex items-center justify-between py-3">
                <CategoryBadge categoryLabel={c.label} categoryColor={c.color} />
                {c.type === "custom" ? (
                  <Button
                    variant="ghost"
                    onClick={() => setDeleteTarget(c)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1"
                  >
                    Delete
                  </Button>
                ) : (
                  <span className="text-xs text-gray-400">Preset</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </FormDrawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Category"
        description="Are you sure? Transactions in this category will lose this association."
        variant="danger"
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => {
          if (deleteTarget?.categoryId) {
            remove.mutate(deleteTarget.categoryId, { onSuccess: () => setDeleteTarget(null) });
          }
        }}
      />
    </>
  );
}

ManageCategoriesDialog.displayName = "ManageCategoriesDialog";

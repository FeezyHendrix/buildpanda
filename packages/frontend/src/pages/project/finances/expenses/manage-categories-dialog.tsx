import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { FormDrawer } from "@/components/molecules/form-drawer";
import {
  useCreateTransactionCategory,
  useDeleteTransactionCategory,
} from "@/hooks/use-transactions";
import { cn } from "@/lib/utils";
import type { TransactionCategoryInfo } from "@/lib/project-types";
import { CategoryBadge, expenseInputClass } from "./expense-dialogs";

const SWATCHES = [
  "#10B981", "#3B82F6", "#6366F1", "#8B5CF6",
  "#EC4899", "#F43F5E", "#F59E0B", "#F97316",
];

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
            <h4 className="text-sm font-semibold text-ink">Custom Categories</h4>
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
                className="size-[46px] cursor-pointer rounded-lg border border-line bg-white p-1"
              />
              <Button onClick={handleCreate} disabled={!newLabel.trim() || create.isPending}>
                Add
              </Button>
            </div>
          </div>

          <ul className="divide-y divide-line-hair border-t border-line-hair">
            {categories.map((c) => (
              <li key={c.key} className="flex items-center justify-between py-3">
                <CategoryBadge categoryLabel={c.label} categoryColor={c.color} />
                {c.type === "custom" ? (
                  <Button variant="danger" size="sm" onClick={() => setDeleteTarget(c)}>
                    Delete
                  </Button>
                ) : (
                  <span className="text-xs text-ink-muted">Preset</span>
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

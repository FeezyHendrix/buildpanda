import { useState } from "react";
import { Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { DRAWER_FIELD_CLASS, DRAWER_LABEL_CLASS } from "@/components/molecules/drawer-fields";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { useCreateTransactionCategory, useDeleteTransactionCategory } from "@/hooks/use-transactions";
import { cn } from "@/lib/utils";
import type { TransactionCategoryInfo } from "@/lib/project-types";
import { CategoryBadge } from "./category-badge";

const DEFAULT_COLOR = "#FFE500";

function CategoryRow({ category, onDelete }: { category: TransactionCategoryInfo; onDelete: (category: TransactionCategoryInfo) => void }) {
  return (
    <li className="flex h-[36px] items-center justify-between bg-white px-[8px]">
      <CategoryBadge categoryLabel={category.label} categoryColor={category.color} />
      {category.type === "custom" ? (
        <button
          type="button"
          onClick={() => onDelete(category)}
          className="text-caption-m font-medium text-error-600 outline-none hover:underline focus-visible:underline"
        >
          Delete
        </button>
      ) : (
        <span className="text-caption-m text-[#737373]">Presets</span>
      )}
    </li>
  );
}

CategoryRow.displayName = "CategoryRow";

interface ManageCategoriesDialogProps {
  projectId: string;
  categories: TransactionCategoryInfo[];
  onClose: () => void;
}

/** Presets plus the project's own categories; a custom one is a label and a colour. */
export function ManageCategoriesDialog({ projectId, categories, onClose }: ManageCategoriesDialogProps) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [deleteTarget, setDeleteTarget] = useState<TransactionCategoryInfo | null>(null);

  const create = useCreateTransactionCategory(projectId);
  const remove = useDeleteTransactionCategory(projectId);
  const canAdd = newLabel.trim().length > 0 && !create.isPending;

  function handleCreate(): void {
    if (!canAdd) return;
    create.mutate({ label: newLabel.trim(), color: newColor }, { onSuccess: () => setNewLabel("") });
  }

  return (
    <>
      <FormDrawer
        open
        onOpenChange={(open) => !open && onClose()}
        title="Manage Categories"
        submitLabel="Done"
        onSubmit={onClose}
        footerVariant="stacked"
        className="w-[min(430px,100vw)]"
        titleClassName="text-[20px] leading-[28px] tracking-normal"
        headerClassName="px-[24px] pb-[23px] pt-[40px]"
        bodyClassName="gap-[20px] px-[24px] py-0"
        footerClassName="gap-[3px] px-[24px] pb-[17px] pt-6 [&>button]:h-[46px]"
      >
        <div className="flex flex-col gap-[5px]">
          <label htmlFor="custom-category" className={DRAWER_LABEL_CLASS}>
            Custom Category
          </label>
          <div className="flex items-center gap-[8px]">
            <input
              id="custom-category"
              className={cn(DRAWER_FIELD_CLASS, "h-[36px] flex-1")}
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                // Enter adds the category; it must not submit the drawer's form.
                event.preventDefault();
                handleCreate();
              }}
              placeholder="e.g. Site security"
              maxLength={40}
            />
            <input
              type="color"
              aria-label="Category colour"
              value={newColor}
              onChange={(event) => setNewColor(event.target.value)}
              className="size-[36px] shrink-0 cursor-pointer border border-[#EEEEEE] bg-white p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0"
            />
            <button
              type="button"
              aria-label="Add category"
              onClick={handleCreate}
              disabled={!canAdd}
              className="flex size-[36px] shrink-0 items-center justify-center bg-[#004DE7] text-white outline-none transition-colors hover:bg-[#003FC0] focus-visible:ring-2 focus-visible:ring-[#004DE7]/30 disabled:opacity-50"
            >
              <Plus className="size-[18px]" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>

        <ul className="flex flex-col gap-[4px] border border-[#EEEEEE] bg-[#F5F5F5] p-[3px]">
          {categories.map((category) => (
            <CategoryRow key={category.key} category={category} onDelete={setDeleteTarget} />
          ))}
        </ul>
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

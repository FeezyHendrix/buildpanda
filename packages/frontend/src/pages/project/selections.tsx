import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import {
  SelectionCard,
} from "@/components/molecules/selection-card";
import {
  UpsertSelectionDialog,
  type UpsertSelectionValues,
} from "@/components/molecules/upsert-selection-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateSelection,
  useCreateSelectionChangeRequest,
  useDecideSelection,
  useDeleteSelection,
  useSelections,
  useUpdateSelection,
} from "@/hooks/use-selections";
import { cn } from "@/lib/utils";
import { formatWholeCurrency } from "@/lib/formatters";
import { canResourceAction } from "@/lib/project-types";
import type { Selection, SelectionOption, SelectionStatus } from "@/lib/project-types";

const FILTERS: { value: SelectionStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "decided", label: "Decided" },
  { value: "cancelled", label: "Cancelled" },
];

function decideDescription(selection: Selection, option: SelectionOption): string {
  const price =
    option.price === null ? "a price to be confirmed" : formatWholeCurrency(option.price, selection.currency);
  if (selection.allowanceAmount === null || option.price === null) {
    return `Choose "${option.name}" (${price}) for ${selection.title}.`;
  }
  const allowance = formatWholeCurrency(selection.allowanceAmount, selection.currency);
  const delta = option.price - selection.allowanceAmount;
  if (delta > 0) {
    const over = formatWholeCurrency(delta, selection.currency);
    return `Choose "${option.name}" (${price}) for ${selection.title}. The allowance is ${allowance}, so this is ${over} over allowance and may become a change request.`;
  }
  return `Choose "${option.name}" (${price}) for ${selection.title}. This is within the ${allowance} allowance.`;
}

export default function ProjectSelections() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "selections", "manage");
  const canDecide = access?.capabilities?.canDecideSelections ?? false;

  const [filter, setFilter] = useState<SelectionStatus | "all">("all");
  const { data: selections = [], isPending } = useSelections(
    project.id,
    filter === "all" ? undefined : filter,
  );

  const createSelection = useCreateSelection();
  const updateSelection = useUpdateSelection();
  const deleteSelection = useDeleteSelection();
  const decideSelection = useDecideSelection();
  const createChangeRequest = useCreateSelectionChangeRequest();

  const [createOpen, setCreateOpen] = useState(false);
  const [editSelection, setEditSelection] = useState<Selection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Selection | null>(null);
  const [decideTarget, setDecideTarget] = useState<{
    selection: Selection;
    option: SelectionOption;
  } | null>(null);

  const openCount = selections.filter((s) => s.status === "open").length;

  function handleCreate(values: UpsertSelectionValues): void {
    createSelection.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  function handleEdit(values: UpsertSelectionValues): void {
    if (!editSelection) return;
    updateSelection.mutate(
      { projectId: project.id, selectionId: editSelection.id, ...values },
      { onSuccess: () => setEditSelection(null) },
    );
  }

  function handleReopen(selection: Selection): void {
    updateSelection.mutate({ projectId: project.id, selectionId: selection.id, status: "open" });
  }

  function handleDecide(): void {
    if (!decideTarget) return;
    decideSelection.mutate(
      {
        projectId: project.id,
        selectionId: decideTarget.selection.id,
        optionId: decideTarget.option.id,
      },
      { onSettled: () => setDecideTarget(null) },
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="Selections"
        description="Finishes and fixtures for the homeowner to choose, each with an allowance and a deadline."
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4" />
              New selection
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 flex flex-col lg:flex-row flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-1 overflow-x-auto max-w-full">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 self-end lg:self-auto">
          {openCount} awaiting a decision
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {isPending ? (
          <div className="flex justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : selections.length === 0 ? (
          <EmptyState
            className="py-16"
            title="No selections yet"
            description={
              canManage
                ? "Create a selection to ask the homeowner to choose a finish or fixture within an allowance."
                : "Selections your builder asks you to make will appear here."
            }
            action={
              canManage ? (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <PlusIcon className="size-4" />
                  New selection
                </Button>
              ) : undefined
            }
          />
        ) : (
          selections.map((selection) => (
            <SelectionCard
              key={selection.id}
              selection={selection}
              projectId={project.id}
              canManage={canManage}
              canDecide={canDecide}
              onPickOption={(sel, option) => setDecideTarget({ selection: sel, option })}
              onEdit={setEditSelection}
              onDelete={setDeleteTarget}
              onReopen={handleReopen}
              onCreateChangeRequest={(sel) =>
                createChangeRequest.mutate({ projectId: project.id, selectionId: sel.id })
              }
              creatingChangeRequest={
                createChangeRequest.isPending &&
                createChangeRequest.variables?.selectionId === selection.id
              }
            />
          ))
        )}
      </div>

      <UpsertSelectionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        currency={project.currency}
        onSubmit={handleCreate}
        isSubmitting={createSelection.isPending}
        error={(createSelection.error as Error | undefined)?.message ?? null}
      />

      <UpsertSelectionDialog
        open={editSelection !== null}
        onOpenChange={(o) => !o && setEditSelection(null)}
        mode="edit"
        currency={editSelection?.currency ?? project.currency}
        initial={
          editSelection
            ? {
                title: editSelection.title,
                category: editSelection.category,
                description: editSelection.description,
                allowanceAmount: editSelection.allowanceAmount,
                dueDate: editSelection.dueDate,
                options: editSelection.options.map((o) => ({
                  name: o.name,
                  description: o.description,
                  price: o.price,
                })),
              }
            : undefined
        }
        onSubmit={handleEdit}
        isSubmitting={updateSelection.isPending}
        error={(updateSelection.error as Error | undefined)?.message ?? null}
      />

      <ConfirmDialog
        open={decideTarget !== null}
        onOpenChange={(o) => !o && setDecideTarget(null)}
        onConfirm={handleDecide}
        title="Confirm your choice"
        description={decideTarget ? decideDescription(decideTarget.selection, decideTarget.option) : undefined}
        confirmLabel="Choose this option"
        loading={decideSelection.isPending}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteSelection.mutate(
              { projectId: project.id, selectionId: deleteTarget.id },
              { onSettled: () => setDeleteTarget(null) },
            );
          }
        }}
        title="Delete selection"
        description="This permanently removes the selection and its options."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteSelection.isPending}
      />
    </div>
  );
}

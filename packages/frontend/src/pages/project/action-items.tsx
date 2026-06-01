import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertActionItemDialog,
  type UpsertActionItemValues,
} from "@/components/molecules/upsert-action-item-dialog";
import {
  ActionItemDetailDialog,
  ACTION_PRIORITY_META,
  ACTION_STATUS_META,
} from "@/components/molecules/action-item-detail-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useActionItems,
  useCreateActionItem,
  useDeleteActionItem,
  useUpdateActionItem,
} from "@/hooks/use-action-items";
import { cn } from "@/lib/utils";
import type { ActionItem, ActionStatus } from "@/lib/project-mock-data";

const FILTERS: { value: ActionStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Open", label: "Open" },
  { value: "InProgress", label: "In progress" },
  { value: "Blocked", label: "Blocked" },
  { value: "Resolved", label: "Resolved" },
];

function formatDue(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function ProjectActionItems() {
  const { project } = useProjectContext();
  const [filter, setFilter] = useState<ActionStatus | "all">("all");
  const { data: items = [], isLoading } = useActionItems(
    project.id,
    filter === "all" ? undefined : filter,
  );
  const createItem = useCreateActionItem();
  const updateItem = useUpdateActionItem();
  const deleteItem = useDeleteActionItem();

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ActionItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  function handleCreate(values: UpsertActionItemValues): void {
    createItem.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  function handleEdit(values: UpsertActionItemValues): void {
    if (!editItem) return;
    updateItem.mutate(
      { projectId: project.id, itemId: editItem.id, ...values },
      { onSuccess: () => setEditItem(null) },
    );
  }

  const openCount = items.filter((i) => i.status !== "Resolved").length;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Action Items"
        description="Open issues and to-dos that need attention to keep the build moving."
        actions={
          <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            New item
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">{openCount} open</p>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {isLoading ? (
          <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <Card padding="lg" className="text-center">
            <p className="text-sm font-medium text-gray-900">Nothing here</p>
            <p className="mt-1 text-sm text-gray-500">No action items match this filter.</p>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} padding="md" interactive className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setDetailId(item.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{item.title}</p>
                  <Badge tone={ACTION_STATUS_META[item.status].tone} size="sm">
                    {ACTION_STATUS_META[item.status].label}
                  </Badge>
                  <Badge tone={ACTION_PRIORITY_META[item.priority].tone} size="sm">
                    {item.priority}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  {item.assigneeName && <span>{item.assigneeName}</span>}
                  {formatDue(item.dueDate) && <span>Due {formatDue(item.dueDate)}</span>}
                  {item.commentCount > 0 && <span>{item.commentCount} comment{item.commentCount === 1 ? "" : "s"}</span>}
                </div>
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditItem(item)}
                  className="text-xs font-medium text-gray-500 hover:text-gray-900"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(item.id)}
                  className="text-xs font-medium text-red-500 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </Card>
          ))
        )}
      </div>

      <UpsertActionItemDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createItem.isPending}
        error={(createItem.error as Error | undefined)?.message ?? null}
      />

      <UpsertActionItemDialog
        open={editItem !== null}
        onOpenChange={(o) => !o && setEditItem(null)}
        mode="edit"
        initial={
          editItem
            ? {
                title: editItem.title,
                description: editItem.description,
                status: editItem.status,
                priority: editItem.priority,
                dueDate: editItem.dueDate,
              }
            : undefined
        }
        onSubmit={handleEdit}
        isSubmitting={updateItem.isPending}
        error={(updateItem.error as Error | undefined)?.message ?? null}
      />

      <ActionItemDetailDialog
        open={detailId !== null}
        onOpenChange={(o) => !o && setDetailId(null)}
        projectId={project.id}
        itemId={detailId}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteItem.mutate({ projectId: project.id, itemId: deleteId });
          setDeleteId(null);
        }}
        title="Delete action item"
        description="This permanently removes the item and its comments."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

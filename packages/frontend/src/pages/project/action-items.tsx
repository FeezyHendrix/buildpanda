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
import { KanbanBoard } from "@/components/molecules/kanban-board";
import {
  ACTION_ITEM_COLUMNS,
  actionItemMeta,
  assigneeFooter,
} from "@/components/molecules/kanban-configs";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useActionItems,
  useCreateActionItem,
  useDeleteActionItem,
  useUpdateActionItem,
} from "@/hooks/use-action-items";
import { useParticipants } from "@/hooks/use-participants";
import { cn } from "@/lib/utils";
import { formatDayMonth } from "@/lib/formatters";
import { canResourceAction } from "@/lib/project-types";
import type {
  ActionItem,
  ActionStatus,
  RecurrenceUnit,
} from "@/lib/project-types";

const FILTERS: { value: ActionStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Open", label: "Open" },
  { value: "InProgress", label: "In progress" },
  { value: "Blocked", label: "Blocked" },
  { value: "Resolved", label: "Resolved" },
];

function formatDue(value: string | null): string | null {
  return formatDayMonth(value) || null;
}

function recurrenceLabel(
  unit: RecurrenceUnit,
  interval: number | null,
): string {
  const count = interval ?? 1;
  const noun = unit === "day" ? "day" : unit === "week" ? "week" : "month";
  return count === 1 ? `every ${noun}` : `every ${count} ${noun}s`;
}

export default function ProjectActionItems() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "action-items", "manage");
  const [filter, setFilter] = useState<ActionStatus | "all">("all");
  const [view, setView] = useState<"list" | "board">("list");
  const { data: items = [], isLoading } = useActionItems(
    project.id,
    filter === "all" ? undefined : filter,
  );
  const { data: participants = [] } = useParticipants(project.id);
  const createItem = useCreateActionItem();
  const updateItem = useUpdateActionItem();
  const deleteItem = useDeleteActionItem();

  const assigneeOptions = participants
    .filter((p) => p.userId)
    .map((p) => ({ id: p.userId as string, name: p.name ?? p.email }));

  function handleMove(item: ActionItem, status: ActionStatus): void {
    if (item.status === status) return;
    updateItem.mutate({ projectId: project.id, itemId: item.id, status });
  }

  function handleAssign(item: ActionItem, assigneeId: string | null): void {
    updateItem.mutate({ projectId: project.id, itemId: item.id, assigneeId });
  }

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
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="Action Items"
        description="Open issues and to-dos that need attention to keep the build moving."
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
            >
              <PlusIcon className="size-4" />
              New item
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 flex flex-col lg:flex-row flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-1 overflow-x-auto max-w-full lg:max-w-[657px]">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm whitespace-nowrap font-medium transition-colors",
                filter === f.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 justify-end lg:justify-start self-end lg:self-auto">
          <div className="inline-flex rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-1 self-end lg:self-auto">
            {(["list", "board"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  view === v
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">{openCount} open</p>
        </div>
      </div>

      {view === "board" ? (
        <div className="mt-5">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
          ) : (
            <KanbanBoard
              items={items}
              columns={ACTION_ITEM_COLUMNS}
              canManage={canManage}
              getId={(i) => i.id}
              getStatus={(i) => i.status}
              getTitle={(i) => i.title}
              renderMeta={actionItemMeta}
              renderFooter={(i) => assigneeFooter(i.assigneeName, i.dueDate)}
              onMove={handleMove}
              onOpen={setDetailId}
              assigneeOptions={assigneeOptions}
              getAssigneeId={(i) => i.assigneeId}
              onAssign={handleAssign}
            />
          )}
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
          ) : items.length === 0 ? (
            <Card padding="lg" className="text-center">
              <p className="text-sm font-medium text-gray-900">Nothing here</p>
              <p className="mt-1 text-sm text-gray-500">
                No action items match this filter.
              </p>
            </Card>
          ) : (
            items.map((item) => (
              <Card
                key={item.id}
                padding="md"
                interactive
                className="flex items-center gap-4"
              >
                <button
                  type="button"
                  onClick={() => setDetailId(item.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {item.title}
                    </p>
                    <Badge
                      tone={ACTION_STATUS_META[item.status].tone}
                      size="sm"
                    >
                      {ACTION_STATUS_META[item.status].label}
                    </Badge>
                    <Badge
                      tone={ACTION_PRIORITY_META[item.priority].tone}
                      size="sm"
                    >
                      {item.priority}
                    </Badge>
                    {item.recurrenceUnit && (
                      <span className="rounded-md bg-[#EEF2FF] px-2 py-0.5 text-xs font-semibold text-[#004DE7]">
                        Repeats{" "}
                        {recurrenceLabel(
                          item.recurrenceUnit,
                          item.recurrenceInterval,
                        )}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {item.assigneeName && <span>{item.assigneeName}</span>}
                    {formatDue(item.dueDate) && (
                      <span>Due {formatDue(item.dueDate)}</span>
                    )}
                    {item.commentCount > 0 && (
                      <span>
                        {item.commentCount} comment
                        {item.commentCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </button>
                {canManage && (
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
                )}
              </Card>
            ))
          )}
        </div>
      )}

      <UpsertActionItemDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        assigneeOptions={assigneeOptions}
        onSubmit={handleCreate}
        isSubmitting={createItem.isPending}
        error={(createItem.error as Error | undefined)?.message ?? null}
      />

      <UpsertActionItemDialog
        open={editItem !== null}
        onOpenChange={(o) => !o && setEditItem(null)}
        mode="edit"
        assigneeOptions={assigneeOptions}
        initial={
          editItem
            ? {
                title: editItem.title,
                description: editItem.description,
                status: editItem.status,
                priority: editItem.priority,
                assigneeId: editItem.assigneeId,
                dueDate: editItem.dueDate,
                recurrenceUnit: editItem.recurrenceUnit,
                recurrenceInterval: editItem.recurrenceInterval,
                recurrenceUntil: editItem.recurrenceUntil,
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
          if (deleteId)
            deleteItem.mutate({ projectId: project.id, itemId: deleteId });
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

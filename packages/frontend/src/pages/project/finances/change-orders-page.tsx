import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { CreateButton } from "@/components/molecules/create-button";
import { UpsertChangeRequestDialog, type UpsertChangeValues } from "@/components/molecules/upsert-change-request-dialog";
import { useSetPageTitle } from "@/contexts/page-title-context";
import {
  useChangeRequests,
  useCreateChangeRequest,
  useDeleteChangeRequest,
  useUpdateChangeRequest,
} from "@/hooks/use-change-requests";
import { useParticipants } from "@/hooks/use-participants";
import { useProjectContext } from "@/layouts/project-layout";
import { getApiErrorMessage } from "@/lib/api-error";
import { canResourceAction, type ChangeRequest } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { AssignDialog } from "./change-orders/assign-dialog";
import { ChangeOrderBoard } from "./change-orders/change-order-board";
import { ChangeOrderSheet } from "./change-orders/change-order-sheet";
import type { TypePill } from "./change-orders/change-order-model";
import { BoardFilters, type StatusPill } from "./change-orders/board-filters";

const EMPTY_CHANGES: ChangeRequest[] = [];

function toInitial(cr: ChangeRequest): UpsertChangeValues {
  return {
    title: cr.title,
    description: cr.description,
    reason: cr.reason,
    reasonHtml: cr.reasonHtml,
    costImpact: cr.costImpact,
    timeImpactDays: cr.timeImpactDays,
    currency: cr.currency,
    assigneeId: cr.assigneeId,
    type: cr.type,
    stageId: cr.stageId,
    rfiId: cr.rfiId,
    delayIds: cr.delays.map((delay) => delay.id),
  };
}

/**
 * Change orders: every scope, cost and time change on the project, laid out by
 * where it stands on the ladder. It is a board over the same change-request
 * records the register shows, so nothing here is a second copy: a card moves
 * only when an action in the sheet moves it.
 */
export default function ProjectChangeOrdersPage() {
  useSetPageTitle("Change Orders", "Scope, cost and time changes, and where each one stands.");
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "change-requests", "manage");

  const { data: changes = EMPTY_CHANGES, isPending } = useChangeRequests(project.id);
  const { data: participants = [] } = useParticipants(project.id);
  const createCr = useCreateChangeRequest();
  const updateCr = useUpdateChangeRequest();
  const deleteCr = useDeleteChangeRequest();

  const [type, setType] = useState<TypePill>("all");
  const [status, setStatus] = useState<StatusPill>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ChangeRequest | null>(null);
  const [assignItem, setAssignItem] = useState<ChangeRequest | null>(null);
  const [deleteItem, setDeleteItem] = useState<ChangeRequest | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const visible = useMemo(() => (type === "all" ? changes : changes.filter((cr) => cr.type === type)), [changes, type]);
  const assigneeOptions = useMemo(
    () => participants.filter((p) => p.userId).map((p) => ({ id: p.userId as string, name: p.name ?? p.email })),
    [participants],
  );

  // A new change order starts as a draft; it is submitted for a decision from its sheet.
  function handleCreate(values: UpsertChangeValues): void {
    createCr.mutate(
      { projectId: project.id, ...values },
      {
        onSuccess: () => {
          setCreateOpen(false);
          toast("Change order created as a draft", "success");
        },
      },
    );
  }

  function handleEdit(values: UpsertChangeValues): void {
    if (!editItem) return;
    updateCr.mutate({ projectId: project.id, changeId: editItem.id, ...values }, { onSuccess: () => setEditItem(null) });
  }

  function handleAssign(assigneeId: string | null): void {
    if (!assignItem) return;
    updateCr.mutate(
      { projectId: project.id, changeId: assignItem.id, assigneeId },
      {
        onSuccess: () => {
          setAssignItem(null);
          toast(assigneeId ? "Change order assigned" : "Change order unassigned", "success");
        },
      },
    );
  }

  return (
    <div className="w-full px-4 pb-8 pt-[24px] sm:px-10 lg:px-[40px]">
      <div className="flex min-h-[36px] justify-end">
        {canManage ? (
          <CreateButton onClick={() => setCreateOpen(true)} className="h-[36px] gap-[8px] px-[16px] text-[14px] font-semibold">
            Change an Order
          </CreateButton>
        ) : null}
      </div>

      <div className="mt-[24px]">
        <BoardFilters status={status} onStatusChange={setStatus} type={type} onTypeChange={setType} />
      </div>

      <div className="mt-[24px]">
        {isPending ? (
          <div className="flex justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : (
          <ChangeOrderBoard
            changes={visible}
            statuses={status === "all" ? undefined : [status]}
            projectId={project.id}
            canManage={canManage}
            onView={(cr) => setViewId(cr.id)}
            onAssign={setAssignItem}
            onEdit={setEditItem}
            onDelete={setDeleteItem}
          />
        )}
      </div>

      <ChangeOrderSheet
        open={viewId !== null}
        onOpenChange={(next) => !next && setViewId(null)}
        projectId={project.id}
        changeId={viewId}
        canManage={canManage}
      />

      <UpsertChangeRequestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={project.id}
        mode="create"
        createLabel="Create"
        assigneeOptions={assigneeOptions}
        onSubmit={handleCreate}
        isSubmitting={createCr.isPending}
        error={createCr.error ? getApiErrorMessage(createCr.error) : null}
      />
      <UpsertChangeRequestDialog
        open={editItem !== null}
        onOpenChange={(next) => !next && setEditItem(null)}
        projectId={project.id}
        mode="edit"
        assigneeOptions={assigneeOptions}
        initial={editItem ? toInitial(editItem) : undefined}
        onSubmit={handleEdit}
        isSubmitting={updateCr.isPending}
        error={updateCr.error ? getApiErrorMessage(updateCr.error) : null}
      />

      <AssignDialog
        change={assignItem}
        options={assigneeOptions}
        onClose={() => setAssignItem(null)}
        onSubmit={handleAssign}
        isSubmitting={updateCr.isPending}
        error={updateCr.error && assignItem ? getApiErrorMessage(updateCr.error) : null}
      />

      <ConfirmDialog
        open={deleteItem !== null}
        onOpenChange={(next) => !next && setDeleteItem(null)}
        loading={deleteCr.isPending}
        onConfirm={() => {
          if (!deleteItem) return;
          deleteCr.mutate(
            { projectId: project.id, changeId: deleteItem.id },
            {
              onSuccess: () => setDeleteItem(null),
              // A change order with a signed contract or an executed award refuses deletion with a reason.
              onError: (error) => toast(getApiErrorMessage(error), "error"),
            },
          );
        }}
        title="Delete change order"
        description="This permanently removes the change order and its discussion."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

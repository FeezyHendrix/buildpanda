import { useState } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { CommentPanel } from "@/components/molecules/comment-panel";
import { MediaGallery } from "@/components/molecules/media-gallery";
import {
  UpsertUpdateDialog,
  type UpsertUpdateValues,
} from "@/components/molecules/upsert-update-dialog";
import {
  useAddComment,
  useDeleteUpdate,
  useEditUpdate,
  usePublishUpdate,
  useTransitionUpdate,
  useUpdateComments,
} from "@/hooks/use-updates";
import { formatDateTime, formatTimeAgo } from "@/lib/formatters";
import { UPDATE_CATEGORY_TONE } from "@/lib/project-meta";
import { cn } from "@/lib/utils";
import type { ProjectUpdate, UpdateCategory, UpdateStatus } from "@/lib/project-types";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";

const CATEGORY_TARGET_STATUS: Record<UpdateCategory, Exclude<UpdateStatus, "Open">> = {
  Progress: "Approved",
  "Material Delivery": "Inspected",
  Inspections: "Approved",
  Issues: "Resolved",
};

const STATUS_BADGE_TONE: Record<
  Exclude<UpdateStatus, "Open">,
  "success" | "info" | "warning" | "danger"
> = {
  Approved: "success",
  Inspected: "info",
  Resolved: "success",
  Escalated: "warning",
};

export function UpdateCard({
  projectId,
  update,
  canManage,
}: {
  projectId: string;
  update: ProjectUpdate;
  canManage: boolean;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const transition = useTransitionUpdate();
  const addComment = useAddComment();
  const editUpdate = useEditUpdate();
  const deleteUpdate = useDeleteUpdate();
  const publishUpdate = usePublishUpdate();
  const commentsQuery = useUpdateComments(
    commentsOpen ? projectId : undefined,
    commentsOpen ? update.id : undefined,
  );

  const isOpen = update.status === "Open";
  const targetStatus = CATEGORY_TARGET_STATUS[update.category];

  function handleTransition(): void {
    if (!isOpen || transition.isPending) return;
    transition.mutate({
      projectId,
      updateId: update.id,
      status: targetStatus,
    });
  }

  function handlePostComment(body: string): void {
    addComment.mutate({ projectId, updateId: update.id, body });
  }

  function handleEdit(values: UpsertUpdateValues): void {
    editUpdate.mutate(
      { projectId, updateId: update.id, ...values },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  function handleDelete(): void {
    deleteUpdate.mutate({ projectId, updateId: update.id });
  }

  return (
    <Card className="flex flex-col gap-4 border border-[#F6F6F6] rounded-[8px] p-[24px]">
      <header className="flex flex-wrap gap-3 items-start justify-between">
        <div className="flex gap-2">
          <Avatar
            name={update.author.name}
            src={update.author.avatarUrl}
            size="md"
            className={cn("h-[40px] w-[40px] rounded-[12px]")}
          />
          <div>
            <p className="text-[#131B2E] font-semibold text-[13px]">
              {update.author.name}
            </p>
            <p className="text-black-300 text-[13px]">
              {update.author.role} · {formatDateTime(update.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {update.isDraft && (
            <Badge tone="warning" size="md" dot>
              {update.generatedKind ? "Draft · Panda AI" : "Draft"}
            </Badge>
          )}
          {!update.isDraft && update.status !== "Open" && (
            <Badge tone={STATUS_BADGE_TONE[update.status]} size="md" dot>
              {update.status}
            </Badge>
          )}
          <Badge tone={UPDATE_CATEGORY_TONE[update.category]} size="md">
            {update.category}
          </Badge>
        </div>
      </header>

      <div className='flex flex-col gap-6'>
        <div>
          <h3 className="font-semibold text-[#131B2E]">
            {update.title}
          </h3>
          <p className="text-[13px] text-black-300">
            {update.description}
          </p>
          {!isOpen && update.action.takenBy && update.action.takenAt && (
            <p className="mt-1.5 text-[11px] text-gray-500">
              {update.status} by {update.action.takenBy.name} ·{" "}
              {formatTimeAgo(update.action.takenAt)}
            </p>
          )}
        </div>
        <MediaGallery items={update.media} />
      </div>


      <footer className='flex flex-wrap gap-3 justify-between items-center border-t border-[#F6F6F6] pt-6'>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setCommentsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-black-300 hover:text-black-500 cursor-pointer p-0"
          >
            <ReactSVG src={icons.comment} />
            <p>{commentsOpen ? "Hide comments" : "Comment"}</p>
          </button>
          {update.secondaryAction && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-black-300 hover:text-black-500 p-0 cursor-pointer"
            >
              {update.secondaryAction.label === 'View Report' && <ReactSVG src={icons.report} />}
              {update.secondaryAction.label === 'Escalation Details' && <ReactSVG src={icons.warningCircle} />}
              {update.secondaryAction.label === 'Verify with Panda AI' && <ReactSVG src={icons.aiVerify} />}
              <p>{update.secondaryAction.label}</p>
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              Edit
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="text-xs font-medium text-red-500 hover:text-red-600"
            >
              Delete
            </button>
          )}
        </div>
        {canManage && update.isDraft && (
          <Button
            size="sm"
            variant="primary"
            loading={publishUpdate.isPending}
            onClick={() =>
              publishUpdate.mutate({ projectId, updateId: update.id })
            }
          >
            Publish
          </Button>
        )}
        {canManage && !update.isDraft && (
          <Button
            size="sm"
            variant={update.cta.tone === "primary" ? "primary" : "secondary"}
            loading={transition.isPending}
            disabled={!isOpen}
            onClick={handleTransition}
          >
            {!isOpen
              ? update.status
              : update.cta.label}
          </Button>
        )}
      </footer>

      {commentsOpen && (
        <CommentPanel
          comments={commentsQuery.data ?? []}
          isLoading={commentsQuery.isLoading}
          isSubmitting={addComment.isPending}
          onSubmit={handlePostComment}
        />
      )}

      <UpsertUpdateDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={{
          category: update.category,
          title: update.title,
          description: update.description,
          media: update.media.map((m) => ({ type: m.type, url: m.url })),
        }}
        onSubmit={handleEdit}
        isSubmitting={editUpdate.isPending}
        error={(editUpdate.error as Error | undefined)?.message ?? null}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete update"
        description="This permanently removes the update and its comments. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </Card>
  );
}

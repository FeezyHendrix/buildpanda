import { useEffect, useState } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { CommentPanel } from "@/components/molecules/comment-panel";
import { MediaGallery } from "@/components/molecules/media-gallery";
import {
  UpsertUpdateDialog,
  type UpsertUpdateValues,
} from "@/components/molecules/upsert-update-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/atoms/dropdown-menu";
import {
  useAddComment,
  useDeleteUpdate,
  useEditUpdate,
  usePublishUpdate,
  useUpdateComments,
} from "@/hooks/use-updates";
import { formatTimeAgo } from "@/lib/formatters";
import type { ProjectUpdate } from "@/lib/project-types";
import { ReactSVG } from "react-svg";
import { MoreVertical } from "lucide-react";
import { icons2 } from "@/assets/icons2/icon2";

function CategoryBadge({ category }: { category: string }) {
  switch (category) {
    case "Progress":
      return <Badge tone="success">{category}</Badge>;
    case "Inspections":
      return <Badge tone="info">{category}</Badge>;
    case "Issues":
      return <Badge tone="warning">{category}</Badge>;
    case "Material Delivery":
    default:
      return <Badge tone="neutral">{category}</Badge>;
  }
}

export function UpdateCard({
  projectId,
  update,
  canManage,
  autoEdit = false,
  onAutoEditHandled,
}: {
  projectId: string;
  update: ProjectUpdate;
  canManage: boolean;
  autoEdit?: boolean;
  onAutoEditHandled?: () => void;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (autoEdit && canManage) {
      setEditOpen(true);
      onAutoEditHandled?.();
    }
  }, [autoEdit, canManage, onAutoEditHandled]);

  const addComment = useAddComment();
  const editUpdate = useEditUpdate();
  const deleteUpdate = useDeleteUpdate();
  const publishUpdate = usePublishUpdate();
  const commentsQuery = useUpdateComments(
    commentsOpen ? projectId : undefined,
    commentsOpen ? update.id : undefined,
  );

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
    <div className="border-b-[0.5px] border-border first:border-t-[0.5px] py-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar
            name={update.author.name}
            src={update.author.avatarUrl}
            size="md"
            className="size-10 rounded-full shrink-0 bg-success-100 !text-success-500 font-semibold text-caption-l"
          />
          <div>
            <p className="text-caption-l font-semibold text-black-500">
              {update.author.name}
            </p>
            <p className="text-caption-l text-grey-450 font-medium">
              {update.author.role}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <CategoryBadge category={update.category} />
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<button type="button" className="flex size-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600" />}
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[148px] p-1">
                <DropdownMenuItem onSelect={() => setEditOpen(true)} className="flex items-center gap-2.5 py-2 text-[13px]">
                  <ReactSVG src={icons2.edit} className="[&_svg]:size-4 shrink-0" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem tone="danger" onSelect={() => setDeleteOpen(true)} className="flex items-center gap-2.5 py-2 text-[13px]">
                  <ReactSVG src={icons2.delete} className="[&_svg]:size-4 shrink-0" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="mt-3.5">
        <h3 className="text-caption-l font-semibold text-black-500">{update.title}</h3>
        {update.description && (
          <p className="mt-1 text-caption-l text-grey-450">{update.description}</p>
        )}
      </div>

      {/* Media */}
      {update.media.length > 0 && (
        <MediaGallery items={update.media} className="mt-3.5" />
      )}

      {/* Timestamp */}
      <p className="mt-3.5 text-caption-m italic text-grey-450">{formatTimeAgo(update.createdAt)}</p>

      {/* Actions */}
      <div className="mt-2.5 flex items-center gap-3">
        <Button
          size='md'
          variant='secondary'
          onClick={() => setCommentsOpen((prev) => !prev)}
          className='text-caption-l text-grey-450 font-medium'
        >
          <ReactSVG src={icons2.comment} />
          <span>{commentsOpen ? "Hide comments" : "Comment"}</span>
        </Button>

        {canManage && update.isDraft && (
          <Button
            size="md"
            variant="primary"
            loading={publishUpdate.isPending}
            onClick={() => publishUpdate.mutate({ projectId, updateId: update.id })}
          >
            Publish
          </Button>
        )}

        {/* {update.secondaryAction && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#F5F5F5] px-3 py-1.5 text-[12px] font-medium text-grey-500 hover:bg-[#EBEBEB] transition-colors"
          >
            {update.secondaryAction.label === "View Report" && <ReactSVG src={icons.report} />}
            {update.secondaryAction.label === "Escalation Details" && <ReactSVG src={icons.warningCircle} />}
            {update.secondaryAction.label === "Verify with Panda AI" && <ReactSVG src={icons.aiVerify} />}
            <span>{update.secondaryAction.label}</span>
          </button>
        )} */}
      </div>

      {commentsOpen && (
        <div className="mt-3">
          <CommentPanel
            comments={commentsQuery.data ?? []}
            isLoading={commentsQuery.isLoading}
            isSubmitting={addComment.isPending}
            onSubmit={handlePostComment}
          />
        </div>
      )}

      <UpsertUpdateDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        projectId={projectId}
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
    </div>
  );
}

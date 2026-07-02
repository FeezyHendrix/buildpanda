import { useEffect, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Avatar } from "@/components/atoms/avatar";
import { FileViewerDialog } from "@/components/molecules/file-viewer-dialog";
import { cn } from "@/lib/utils";
import { formatDayMonth } from "@/lib/formatters";
import { resolveFileUrl } from "@/hooks/use-files";
import type { Task } from "@/lib/project-types";
import { ENTITY_META, LinkGlyph, PriorityBadge, firstImageFileId, htmlToText } from "./task-ui";

export function TaskCard({
  task,
  canManage,
  onOpen,
}: {
  task: Task;
  canManage: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !canManage,
  });
  const due = formatDayMonth(task.dueDate) || null;
  const coverFileId = firstImageFileId(task.descriptionHtml);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  useEffect(() => {
    if (!coverFileId) {
      setCoverUrl(null);
      return;
    }
    let cancelled = false;
    void resolveFileUrl(coverFileId)
      .then((url) => {
        if (!cancelled) setCoverUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [coverFileId]);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "touch-manipulation overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow",
        isDragging ? "opacity-50 shadow-md" : "hover:shadow-md",
        canManage && "cursor-grab active:cursor-grabbing",
      )}
      {...(canManage ? listeners : {})}
      {...attributes}
    >
      {coverUrl && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setViewerOpen(true);
          }}
          className="group relative block w-full overflow-hidden text-left"
          aria-label="View task image"
        >
          <img
            src={coverUrl}
            alt=""
            className="h-28 w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02]"
            draggable={false}
          />
          <span className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-gray-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
            View
          </span>
        </button>
      )}
      <div className="p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <PriorityBadge priority={task.priority} />
          {task.entityLinkTypes.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-1">
              {task.entityLinkTypes.map((type) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 rounded bg-[#EEF2FF] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#004DE7]"
                  title={`Linked to ${ENTITY_META[type].label.toLowerCase()}`}
                >
                  <LinkGlyph />
                  {ENTITY_META[type].label}
                </span>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={onOpen} className="block w-full text-left outline-none">
          <p className="text-sm font-medium text-gray-900">{task.title}</p>
          {task.description && htmlToText(task.description) && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-500">{htmlToText(task.description)}</p>
          )}
        </button>
        {task.labels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {task.labels.slice(0, 3).map((label) => (
              <span
                key={label}
                className="inline-flex max-w-[140px] items-center truncate rounded-full bg-[#F6F6F6] px-2 py-0.5 text-[11px] font-medium text-gray-600"
              >
                {label}
              </span>
            ))}
            {task.labels.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-[#F6F6F6] px-2 py-0.5 text-[11px] font-medium text-gray-400">
                +{task.labels.length - 3}
              </span>
            )}
          </div>
        )}
        {(task.assigneeName || due || task.subtaskTotal > 0) && (
          <div className="mt-2.5 flex items-center justify-between">
            {task.assigneeName ? (
              <div className="flex items-center gap-1.5">
                <Avatar name={task.assigneeName} size="sm" />
                <span className="text-xs text-gray-600">{task.assigneeName}</span>
              </div>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              {task.subtaskTotal > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#F6F6F6] px-2 py-0.5 text-[11px] font-medium text-gray-500">
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  {task.subtaskDone}/{task.subtaskTotal}
                </span>
              )}
              {due && (
                <span className="rounded-full bg-[#F6F6F6] px-2 py-0.5 text-[11px] font-medium text-gray-500">
                  {due}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      {coverUrl && (
        <FileViewerDialog
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          title={task.title}
          fileName="Task image.jpg"
          url={coverUrl}
        />
      )}
    </div>
  );
}

TaskCard.displayName = "TaskCard";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/atoms/avatar";
import { Button } from "@/components/atoms/button";
import {
  useAssignableUsers,
  useTaskDetail,
  useAddTaskComment,
} from "@/hooks/use-tasks";
import { useProjectContext } from "@/layouts/project-layout";
import { toast } from "@/lib/toast";
import { formatTimeAgo } from "@/lib/formatters";
import { htmlToText, PriorityBadge } from "./task-ui";
import type { Task } from "@/lib/project-types";
import { RichTextEditor } from "@/components/molecules/rich-text-editor";
import { TaskImageGallery } from "./task-image-gallery";
import { Badge } from "@/components";

interface TaskDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  taskId: string | null;
  task?: Task | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TaskDetailSheet({
  open,
  onOpenChange,
  projectId,
  taskId,
  task,
}: TaskDetailSheetProps) {
  const { data: detail } = useTaskDetail(projectId, taskId);
  const displayTask = (detail as unknown as Task) ?? task;
  const { data: assignable = [] } = useAssignableUsers(projectId);
  const { access } = useProjectContext();
  const canComment = access?.capabilities?.canComment ?? true;
  const addComment = useAddTaskComment(projectId, taskId ?? "");

  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);

  function copyTaskLink(): void {
    if (!task) return;
    const url = `${window.location.origin}${window.location.pathname}?task=${task.id}`;
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 1500);
      })
      .catch(() => toast("Could not copy link"));
  }

  function stripImages(html: string): string {
    if (!html) return html;
    if (typeof document === "undefined")
      return html.replace(/<img[^>]*>/gi, "");
    const div = document.createElement("div");
    div.innerHTML = html;
    div.querySelectorAll("img").forEach((el) => el.remove());
    div.querySelectorAll("p").forEach((p) => {
      if (!p.textContent?.trim() && p.children.length === 0) p.remove();
    });
    return div.innerHTML;
  }

  useEffect(() => {
    if (!open) {
      setExpanded(false);
      setIsClamped(false);
      return;
    }
    let ro: ResizeObserver | undefined;
    // rAF lets the dialog finish its enter transition before we measure
    const id = requestAnimationFrame(() => {
      const el = descRef.current;
      if (!el) return;
      const check = () => setIsClamped(el.scrollHeight > 245);
      ro = new ResizeObserver(check);
      ro.observe(el);
      check();
    });
    return () => {
      cancelAnimationFrame(id);
      ro?.disconnect();
    };
  }, [open, taskId, displayTask?.descriptionHtml, displayTask?.description]);

  const [commentHtml, setCommentHtml] = useState("");
  const [commentText, setCommentText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const mentionAnchorRef = useRef<HTMLDivElement>(null);

  const members = useMemo(
    () =>
      assignable
        .filter((a) => a.kind === "user")
        .map((a) => ({ id: a.id, name: a.name })),
    [assignable],
  );

  const filteredMembers = useMemo(() => {
    if (mentionQuery === null) return members;
    const q = mentionQuery.toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q));
  }, [members, mentionQuery]);

  function handleCommentChange(html: string, text: string) {
    setCommentHtml(html);
    setCommentText(text);
    const m = text.match(/@(\w*)$/);
    if (m) {
      setMentionQuery(m[1] ?? "");
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
      setMentionQuery(null);
    }
  }

  function replaceLastAtQuery(source: string, name: string): string {
    const lastAt = source.lastIndexOf("@");
    if (lastAt === -1) return `${source}${source ? " " : ""}@${name} `;
    const afterAt = source.slice(lastAt + 1);
    const qMatch = afterAt.match(/^(\w*)/);
    const qLen = qMatch?.[1]?.length ?? 0;
    const before = source.slice(0, lastAt);
    const after = source.slice(lastAt + 1 + qLen);
    const needsSpace = after.length === 0 || after[0] !== " ";
    return `${before}@${name}${needsSpace ? " " : ""}${after}`.replace(
      /\s{2,}/g,
      " ",
    );
  }

  function insertMention(name: string) {
    const newText = replaceLastAtQuery(commentText, name);
    const newHtml = replaceLastAtQuery(commentHtml || commentText, name);
    const htmlToSet = newHtml.includes("<") ? newHtml : `<p>${newText}</p>`;
    setCommentText(newText);
    setCommentHtml(htmlToSet);
    setMentionOpen(false);
    setMentionQuery(null);
  }

  function submitComment() {
    const html = commentHtml.trim();
    const text = commentText.trim();
    if (!text) return;
    const body = html || text;
    addComment.mutate(body, {
      onSuccess: () => {
        setCommentHtml("");
        setCommentText("");
        setMentionOpen(false);
      },
      onError: () => toast("Could not add comment"),
    });
  }

  const descriptionHtml =
    (displayTask as any)?.descriptionHtml ??
    (displayTask?.description ? `<p>${displayTask.description}</p>` : "");
  const plainDescription = displayTask ? htmlToText(descriptionHtml) : "";
  const hasDescription = Boolean(plainDescription);
  const descriptionWithoutImages = useMemo(
    () => stripImages(descriptionHtml),
    [descriptionHtml],
  );

  if (!displayTask) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-[min(960px,100vw)] flex-col bg-white shadow-xl outline-none data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full transition-transform duration-300">
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">
            {/* Left: Task detail */}
            <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6 no-scrollbar">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={displayTask.priority} />

                  {task && (
                    <Badge
                      onClick={copyTaskLink}
                      className="flex h-6 items-center gap-1.5 rounded-full border-[0.2px] border-border bg-black-50 px-2.5 text-caption-m font-semibold text-grey-450 hover:bg-[#F6F6F6] cursor-pointer"
                    >
                      <svg
                        className="size-3.5 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M10 13a5 5 0 0 0 7.07 0l1.93-1.93a5 5 0 0 0-7.07-7.07L10.5 5.5" />
                        <path d="M14 11a5 5 0 0 0-7.07 0L5 12.93a5 5 0 0 0 7.07 7.07L13.5 18.5" />
                      </svg>
                      {linkCopied ? "Link copied" : "Copy Link"}
                    </Badge>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] hover:bg-[#F6F6F6] hover:text-[#1E1E1E]"
                  aria-label="Close"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <Dialog.Title className="mt-2 text-h6 font-bold text-grey-800">
                {displayTask.title}
              </Dialog.Title>
              {(displayTask as any).createdByName && (
                <p className="mt-1 text-caption-m text-grey-450">
                  Created by{" "}
                  <span className="font-medium italic text-black-500 underline decoration-grey-450 underline-offset-2">
                    {(displayTask as any).createdByName}
                  </span>
                </p>
              )}
              {displayTask.assignees?.[0] &&
                !(displayTask as any).createdByName && (
                  <p className="mt-1 text-xs text-[#9CA3AF]">
                    Created by{" "}
                    <span className="font-medium text-[#1E1E1E]">
                      {displayTask.assignees[0]!.name}
                    </span>
                  </p>
                )}

              {/* Description - Figma exact */}
              <div className="mt-6 border border-[#EBEBEB] bg-white p-4">
                <p className="text-caption-l font-bold text-black-500">
                  Description
                </p>
                {hasDescription ? (
                  <>
                    <div
                      ref={descRef}
                      className={cn(
                        "prose prose-sm mt-2 max-w-none text-caption-l text-black-500 prose-p:my-1 prose-strong:font-semibold prose-strong:text-[#1E1E1E] prose-em:italic prose-a:text-[#004DE7] prose-a:underline prose-s:line-through prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5 prose-li:my-0.5",
                        !expanded && "h-[245px] overflow-hidden",
                      )}
                      dangerouslySetInnerHTML={{
                        __html: descriptionWithoutImages,
                      }}
                    />
                    {(isClamped || expanded) && (
                      <Button
                        type="button"
                        size="md"
                        onClick={() => setExpanded((v) => !v)}
                        className="mt-3 flex w-full bg-primary-50 py-2.5 text-caption-m font-semibold !text-primary hover:bg-primary-100"
                      >
                        {expanded ? "Show Less" : "View Full"}
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="mt-3 py-4 text-center text-sm text-[#9CA3AF]">
                    No description
                  </p>
                )}
              </div>

              <div className="mt-4">
                <TaskImageGallery
                  descriptionHtml={descriptionHtml}
                  projectId={projectId}
                  readOnly
                />
              </div>

              {/* Labels */}
              {displayTask.labels && displayTask.labels.length > 0 && (
                <div className="mt-6">
                  <p className="text-[13px] font-medium text-[#1E1E1E]">
                    Labels
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {displayTask.labels.map((label) => (
                      <Badge
                        key={label}
                        className="inline-flex h-6 rounded-full bg-grey-50 px-2.5 text-caption-m font-semibold text-grey-450"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Assigned to */}
              <div className="mt-6">
                <p className="text-[13px] font-medium text-[#1E1E1E]">
                  Assigned to
                </p>
                <div className="mt-2 flex items-center gap-1">
                  {displayTask.assignees && displayTask.assignees.length > 0 ? (
                    <>
                      <div className="flex gap-1">
                        {displayTask.assignees.slice(0, 3).map((a) => (
                          <Avatar
                            key={`${a.kind}:${a.id}`}
                            name={a.name}
                            size="sm"
                            className="size-8 ring-2 ring-white bg-primary !text-white text-caption-l"
                          />
                        ))}
                      </div>
                      {displayTask.assignees.length > 3 && (
                        <span className="flex size-8 items-center justify-center rounded-full bg-[#E5E5E5] text-caption-l font-semibold text-black-500 ring-1 ring-white">
                          +{displayTask.assignees.length - 3}
                        </span>
                      )}
                    </>
                  ) : displayTask.assigneeName ? (
                    <Avatar name={displayTask.assigneeName} size="sm" />
                  ) : (
                    <span className="text-xs text-[#9CA3AF]">Unassigned</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Comments - header without border-b */}
            <div className="flex w-full flex-col border-t-[0.5px] border-border bg-black-50 lg:w-[360px] lg:shrink-0 lg:border-l lg:border-t-0 no-scrollbar">
              <div className="flex items-center justify-between px-4 py-4">
                <h3 className="text-[14px] font-semibold text-[#1E1E1E]">
                  Comments
                </h3>
                {detail && detail.comments.length > 0 && (
                  <span className="text-xs text-[#9CA3AF]">
                    {detail.comments.length}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
                  {!detail || detail.comments.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[#9CA3AF]">
                      No comments yet
                    </p>
                  ) : (
                    detail.comments.map((c) => (
                      <div key={c.id} className="flex gap-3">
                        <Avatar
                          name={c.authorName}
                          size="sm"
                          className="shrink-0 size-8 bg-primary text-white"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#1E1E1E]">
                              {c.authorName}
                            </span>
                            <span className="text-[11px] text-[#9CA3AF]">
                              {formatTimeAgo(c.createdAt)}
                            </span>
                          </div>
                          <div
                            className="prose prose-sm mt-1 max-w-none text-[13px] leading-5 text-[#404040] prose-p:my-1 prose-p:leading-5 prose-a:text-[#004DE7] prose-a:font-medium prose-strong:font-semibold prose-em:italic prose-ul:list-disc prose-ol:list-decimal [&_a]:no-underline hover:[&_a]:underline"
                            dangerouslySetInnerHTML={{ __html: c.body }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {canComment && (
                  <div className="p-3">
                    <div ref={mentionAnchorRef} className="relative">
                      <div className="border border-[#EBEBEB] bg-white">
                        <RichTextEditor
                          value={commentHtml}
                          onChange={handleCommentChange}
                          projectId={projectId}
                          placeholder="Add a comment"
                        />
                      </div>

                      {mentionOpen && (
                        <div className="absolute bottom-full left-0 right-0 z-10 mb-1 max-h-[200px] overflow-y-auto border border-[#EBEBEB] bg-white shadow-lg no-scrollbar">
                          {filteredMembers.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-[#9CA3AF]">
                              No members found
                            </div>
                          ) : (
                            filteredMembers.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => insertMention(m.name)}
                                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[#F6F6F6] border-b border-[#F6F6F6] last:border-b-0"
                              >
                                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#004DE7] text-[11px] font-semibold text-white">
                                  {getInitials(m.name)}
                                </span>
                                <span className="text-[13px] font-medium text-[#1E1E1E]">
                                  {m.name}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      className="mt-3 w-full"
                      disabled={!commentText.trim() || addComment.isPending}
                      loading={addComment.isPending}
                      onClick={submitComment}
                    >
                      Add Comment
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

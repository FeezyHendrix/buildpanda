import { useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { Button } from "@/components/atoms/button";
import { RichTextEditor } from "@/components/molecules/rich-text-editor";
import { useAddTaskComment, useAssignableUsers } from "@/hooks/use-tasks";
import { useProjectContext } from "@/layouts/project-layout";
import { formatTimeAgo } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import type { TaskComment } from "@/lib/project-types";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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
  return `${before}@${name}${needsSpace ? " " : ""}${after}`.replace(/\s{2,}/g, " ");
}

function CommentRow({ comment }: { comment: TaskComment }) {
  return (
    <div className="flex gap-3">
      <Avatar
        name={comment.authorName}
        size="sm"
        className="shrink-0 size-8 bg-primary text-white"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#1E1E1E]">{comment.authorName}</span>
          <span className="text-[11px] text-[#9CA3AF]">{formatTimeAgo(comment.createdAt)}</span>
        </div>
        <div
          className="prose prose-sm mt-1 max-w-none text-[13px] leading-5 text-[#404040] prose-p:my-1 prose-p:leading-5 prose-a:text-[#004DE7] prose-a:font-medium prose-strong:font-semibold prose-em:italic prose-ul:list-disc prose-ol:list-decimal [&_a]:no-underline hover:[&_a]:underline"
          dangerouslySetInnerHTML={{ __html: comment.body }}
        />
      </div>
    </div>
  );
}

CommentRow.displayName = "CommentRow";

export function TaskCommentsPanel({
  projectId,
  taskId,
  comments,
}: {
  projectId: string;
  taskId: string | null;
  comments: TaskComment[] | null;
}) {
  const { data: assignable = [] } = useAssignableUsers(projectId);
  const { access } = useProjectContext();
  const canComment = access?.capabilities?.canComment ?? true;
  const addComment = useAddTaskComment(projectId, taskId ?? "");

  const [commentHtml, setCommentHtml] = useState("");
  const [commentText, setCommentText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const mentionAnchorRef = useRef<HTMLDivElement>(null);

  const members = useMemo(
    () => assignable.filter((a) => a.kind === "user").map((a) => ({ id: a.id, name: a.name })),
    [assignable],
  );

  const filteredMembers = useMemo(() => {
    if (mentionQuery === null) return members;
    const q = mentionQuery.toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q));
  }, [members, mentionQuery]);

  function handleCommentChange(html: string, text: string): void {
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

  function insertMention(name: string): void {
    const newText = replaceLastAtQuery(commentText, name);
    const newHtml = replaceLastAtQuery(commentHtml || commentText, name);
    setCommentText(newText);
    setCommentHtml(newHtml.includes("<") ? newHtml : `<p>${newText}</p>`);
    setMentionOpen(false);
    setMentionQuery(null);
  }

  function submitComment(): void {
    const html = commentHtml.trim();
    const text = commentText.trim();
    if (!text) return;
    addComment.mutate(html || text, {
      onSuccess: () => {
        setCommentHtml("");
        setCommentText("");
        setMentionOpen(false);
      },
      onError: () => toast("Could not add comment"),
    });
  }

  return (
    <div className="flex w-full flex-col border-t-[0.5px] border-border bg-black-50 lg:w-[360px] lg:shrink-0 lg:border-l lg:border-t-0 no-scrollbar">
      <div className="flex items-center justify-between px-4 py-4">
        <h3 className="text-[14px] font-semibold text-[#1E1E1E]">Comments</h3>
        {comments && comments.length > 0 ? (
          <span className="text-xs text-[#9CA3AF]">{comments.length}</span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
          {!comments || comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#9CA3AF]">No comments yet</p>
          ) : (
            comments.map((c) => <CommentRow key={c.id} comment={c} />)
          )}
        </div>

        {canComment ? (
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

              {mentionOpen ? (
                <div className="absolute bottom-full left-0 right-0 z-10 mb-1 max-h-[200px] overflow-y-auto border border-[#EBEBEB] bg-white shadow-lg no-scrollbar">
                  {filteredMembers.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-[#9CA3AF]">No members found</div>
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
                        <span className="text-[13px] font-medium text-[#1E1E1E]">{m.name}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
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
        ) : null}
      </div>
    </div>
  );
}

TaskCommentsPanel.displayName = "TaskCommentsPanel";

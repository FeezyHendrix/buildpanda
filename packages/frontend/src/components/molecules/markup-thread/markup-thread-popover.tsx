import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ExternalLink, History, RotateCcw, Trash2 } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import {
  MARKUP_KIND,
  type CreateMarkupCommentInput,
  type DrawingMarkup,
  type DrawingMarkupComment,
  type MarkupKind,
} from "@/api/drawing-markup";
import { getApiErrorMessage } from "@/lib/api-error";
import type { CommentAssignee } from "@/lib/markup-meta";
import { toast } from "@/lib/toast";
import { MarkupCommentItem } from "./markup-comment-item";
import { PinPopover, TEXTAREA_CLASS, type PopoverAnchor } from "./pin-popover";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

const KIND_TITLE: Record<MarkupKind, string> = {
  [MARKUP_KIND.PIN]: "Comment",
  [MARKUP_KIND.PEN]: "Pen markup",
  [MARKUP_KIND.CLOUD]: "Revision cloud",
  [MARKUP_KIND.MEASURE]: "Measurement",
};

const SELECT_CLASS = INPUT_SM_CLASS;

/**
 * The mutations a thread writes through. Project drawings and take-off sheets
 * persist to different routes but share the register, so the popover takes the
 * hooks rather than choosing them.
 */
export interface MarkupThreadActions {
  addComment: UseMutationResult<DrawingMarkupComment, Error, CreateMarkupCommentInput & { markupId: string }>;
  resolve: UseMutationResult<DrawingMarkup, Error, { markupId: string; resolved: boolean }>;
  remove: UseMutationResult<{ ok: true }, Error, string>;
}

/** A follow-up raised off the markup (an RFI, an approval), linked to where it lives. */
export interface MarkupThreadLink {
  id: string;
  label: string;
  to: string;
}

interface MarkupThreadPopoverProps {
  anchor: PopoverAnchor;
  markup: DrawingMarkup;
  /** One line under the title: the bill line, or the sheet the markup sits on. */
  subtitle: string | null;
  canEdit: boolean;
  actions: MarkupThreadActions;
  /** When given, a reply can be handed to a participant. */
  assignees?: CommentAssignee[];
  links?: MarkupThreadLink[];
  onClose: () => void;
}

function ThreadBadges({ markup, links }: { markup: DrawingMarkup; links: MarkupThreadLink[] }) {
  const resolved = markup.resolvedAt !== null;
  if (!resolved && markup.isCurrentRevision && links.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {resolved ? (
        <Badge tone="success" size="sm">
          <Check size={10} aria-hidden="true" /> Resolved
        </Badge>
      ) : null}
      {!markup.isCurrentRevision ? (
        <Badge tone="warning" size="sm" title="This revision has been superseded; the markup stays on the sheet it was raised against.">
          <History size={10} aria-hidden="true" /> Raised on {markup.revisionLabel ?? "an earlier revision"}
        </Badge>
      ) : null}
      {links.map((link) => (
        <Link
          key={link.id}
          to={link.to}
          className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700 hover:bg-primary-100"
        >
          <ExternalLink size={10} aria-hidden="true" /> {link.label}
        </Link>
      ))}
    </div>
  );
}
ThreadBadges.displayName = "ThreadBadges";

const NO_LINKS: MarkupThreadLink[] = [];

/**
 * An existing markup's thread: every comment the field or the office posted
 * (text, voice, video, assignee), the follow-ups raised off it, a reply box,
 * resolve/reopen and delete.
 */
export function MarkupThreadPopover({
  anchor,
  markup,
  subtitle,
  canEdit,
  actions,
  assignees,
  links = NO_LINKS,
  onClose,
}: MarkupThreadPopoverProps) {
  const [reply, setReply] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { addComment, resolve, remove } = actions;
  const resolved = markup.resolvedAt !== null;
  const onError = (e: unknown) => toast(getApiErrorMessage(e, "Could not update the comment."), "error");

  function sendReply(): void {
    const body = reply.trim();
    if (!body) return;
    addComment.mutate(
      { markupId: markup.id, body, bodyHtml: null, assigneeId: assigneeId || null },
      {
        onSuccess: () => {
          setReply("");
          setAssigneeId("");
        },
        onError,
      },
    );
  }

  return (
    <PinPopover anchor={anchor} title={KIND_TITLE[markup.kind]} color={markup.color} onClose={onClose}>
      <p className="mt-1.5 truncate text-xs text-gray-500">
        {subtitle}
        {subtitle && markup.authorName ? " · " : ""}
        {markup.authorName ? `raised by ${markup.authorName}` : ""}
      </p>
      <ThreadBadges markup={markup} links={links} />
      <ul className="mt-2 flex max-h-72 flex-col gap-1.5 overflow-y-auto">
        {markup.comments.length === 0 ? (
          <li className="rounded-lg bg-surface-alt px-2.5 py-2 text-xs text-gray-500">No comments yet.</li>
        ) : (
          markup.comments.map((c) => <MarkupCommentItem key={c.id} comment={c} />)
        )}
      </ul>
      {canEdit ? (
        <>
          <textarea
            rows={2}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply();
            }}
            placeholder="Reply…"
            aria-label="Reply"
            className={cn(TEXTAREA_CLASS, "mt-2")}
          />
          {assignees && assignees.length > 0 ? (
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              aria-label="Assign reply to"
              className={cn(SELECT_CLASS, "mt-1.5")}
            >
              <option value="">Assign to nobody</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  Assign to {a.name}
                </option>
              ))}
            </select>
          ) : null}
          {confirmingDelete ? (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-2">
              <p className="text-xs font-medium text-red-700">Delete this markup and every comment on it?</p>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setConfirmingDelete(false)}>
                Keep
              </Button>
              <Button
                size="sm"
                loading={remove.isPending}
                onClick={() => remove.mutate(markup.id, { onSuccess: onClose, onError })}
              >
                Delete
              </Button>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Delete markup"
                title="Delete markup"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 size={14} />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="ml-auto"
                loading={resolve.isPending}
                onClick={() => resolve.mutate({ markupId: markup.id, resolved: !resolved }, { onError })}
              >
                {resolved ? <RotateCcw size={13} /> : <Check size={13} />}
                <span className="ml-1">{resolved ? "Reopen" : "Resolve"}</span>
              </Button>
              <Button size="sm" loading={addComment.isPending} disabled={!reply.trim()} onClick={sendReply}>
                Reply
              </Button>
            </div>
          )}
        </>
      ) : null}
    </PinPopover>
  );
}
MarkupThreadPopover.displayName = "MarkupThreadPopover";

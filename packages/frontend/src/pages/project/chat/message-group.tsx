import { useState } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { formatTimeAgo } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { ReferenceChip } from "./reference-chip";
import { AttachmentChip } from "./attachment-chip";
import { ReplyIcon } from "@/components/atoms/chat-icons";
import type { ChatMessage } from "@/lib/project-types";

export function MessageItem({
  message,
  isOwn,
  isPinned,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onReply,
  onReaction,
  onForward,
}: {
  message: ChatMessage;
  isOwn: boolean;
  isPinned: boolean;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onPin: (m: ChatMessage) => void;
  onUnpin: (m: ChatMessage) => void;
  onReply: (m: ChatMessage) => void;
  onReaction: (m: ChatMessage, emoji: string) => void;
  onForward?: (m: ChatMessage) => void;
}) {
  const [showEmoji, setShowEmoji] = useState(false);

  if (message.deletedAt) {
    return (
      <div className="py-1 text-sm italic text-gray-400">
        This message was deleted
      </div>
    );
  }

  return (
    <div className="group relative py-0.5">
      <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-black-500">
        {message.body}
        {message.editedAt && (
          <span className="ml-2 text-[10px] text-black-300">(edited)</span>
        )}
      </div>

      {message.resolvedReferences && message.resolvedReferences.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {message.resolvedReferences.map((ref) => (
            <ReferenceChip key={`${ref.type}-${ref.id}`} refItem={ref} />
          ))}
        </div>
      )}

      {message.attachments && message.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {message.attachments.map((a) => (
            <AttachmentChip key={a.fileId} attachment={a} />
          ))}
        </div>
      )}

      {message.reactions && message.reactions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {message.reactions.map((r) => (
            <button
              key={r.emoji}
              onClick={() => onReaction(message, r.emoji)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-colors",
                r.mine ? "border-primary-200 bg-primary-50 text-primary-500" : "border-gray-200 bg-gray-50 text-gray-600 hover:border-primary-200"
              )}
            >
              <span>{r.emoji}</span>
              <span className="text-xs font-medium">{r.count}</span>
            </button>
          ))}
        </div>
      )}

      {(message.replyCount ?? 0) > 0 && (
        <div className="mt-1">
          <button 
            onClick={() => onReply(message)} 
            className="inline-flex items-center gap-1.5 rounded-lg border-l-4 border-primary-500 bg-gray-50 px-3 py-2 text-left text-xs font-medium text-primary-500 transition-colors hover:bg-gray-100"
          >
            <ReplyIcon className="size-4" />
            {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
          </button>
        </div>
      )}

      <div className="absolute right-4 -top-2 hidden items-center gap-1 rounded-md border border-gray-200 bg-white p-1 shadow-sm group-hover:flex z-10">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmoji(!showEmoji)}
            className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            title="React"
          >
            😀
          </button>
          {showEmoji && (
            <div className="absolute right-0 bottom-full mb-1 flex gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-md">
              {["👍", "❤️", "😄", "🎉", "👀", "✅"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => { onReaction(message, emoji); setShowEmoji(false); }}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-sm hover:bg-gray-100"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <button
          type="button"
          onClick={() => onReply(message)}
          className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          Reply
        </button>

        <button
          type="button"
          onClick={() => onForward?.(message)}
          className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          → Task
        </button>

        {isPinned ? (
          <button
            type="button"
            onClick={() => onUnpin(message)}
            className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            Unpin
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onPin(message)}
            className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            Pin
          </button>
        )}

        {isOwn && (
          <>
            <button
              type="button"
              onClick={() => onEdit(message)}
              className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(message)}
              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function MessageGroup({
  messages,
  currentUserId,
  pinnedIds,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onReply,
  onReaction,
  onForward,
}: {
  messages: ChatMessage[];
  currentUserId: string;
  pinnedIds: Set<string>;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onPin: (m: ChatMessage) => void;
  onUnpin: (m: ChatMessage) => void;
  onReply: (m: ChatMessage) => void;
  onReaction: (m: ChatMessage, emoji: string) => void;
  onForward?: (m: ChatMessage) => void;
}) {
  const first = messages[0];
  if (!first) return null;

  return (
    <div className="flex gap-3 px-6 py-2">
      <div className="shrink-0">
        <Avatar name={first.authorName ?? "?"} size="md" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-black-500">
            {first.authorName ?? "Unknown User"}
          </span>
          <span className="text-[11px] text-black-300">
            {formatTimeAgo(first.createdAt)}
          </span>
        </div>
        <div className="mt-0.5 flex flex-col">
          {messages.map((m) => (
            <MessageItem
              key={m.id}
              message={m}
              isOwn={m.authorId === currentUserId}
              isPinned={pinnedIds.has(m.id)}
              onEdit={onEdit}
              onDelete={onDelete}
              onPin={onPin}
              onUnpin={onUnpin}
              onReply={onReply}
              onReaction={onReaction}
              onForward={onForward}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { cn } from "@/lib/utils";
import { ReferenceChip } from "./reference-chip";
import { LinkPreviewCard } from "./message-content";
import { MessageMenu, ReactionButton, type MessageActionHandlers } from "./message-actions";
import { MessageActionSheet } from "./message-action-sheet";
import { useLongPress } from "./use-long-press";
import { MessageBubble } from "./message-bubble";
import { QuotedBlock } from "./quoted-block";
import { ReadReceipt } from "./read-receipt";
import { ReplyIcon } from "@/components/atoms/chat-icons";
import type { ChatMessage } from "@/lib/project-types";

type MessageItemProps = MessageActionHandlers & {
  message: ChatMessage;
  isOwn: boolean;
  isPinned: boolean;
  onJumpToMessage?: (messageId: string) => void;
};

export function MessageItem({ message, isOwn, isPinned, onJumpToMessage, ...actions }: MessageItemProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const longPress = useLongPress(() => setSheetOpen(true));

  if (message.deletedAt) {
    return <div className="py-1 text-sm italic text-ink-muted">This message was deleted</div>;
  }

  const { onReaction, ...menuActions } = actions;
  const { onReply } = menuActions;

  return (
    <div id={`message-${message.id}`} className={cn("group relative max-w-full py-[2px] transition-colors", isOwn && "flex flex-col items-end")}>
      {message.quotedMessage && (
        <div className="mb-1">
          <QuotedBlock
            quoted={message.quotedMessage}
            onClick={
              onJumpToMessage && message.quotedMessageId
                ? () => onJumpToMessage(message.quotedMessageId!)
                : undefined
            }
          />
        </div>
      )}

      <div className="relative max-w-full select-none [-webkit-touch-callout:none] lg:select-text" {...longPress}>
        <MessageBubble message={message} own={isOwn} />
        <MessageMenu message={message} isOwn={isOwn} isPinned={isPinned} {...menuActions} />
        <ReactionButton message={message} isOwn={isOwn} onReaction={onReaction} />
      </div>
      <MessageActionSheet open={sheetOpen} onOpenChange={setSheetOpen} message={message} isOwn={isOwn} isPinned={isPinned} {...actions} />

      <LinkPreviewCard text={message.body} />

      {isOwn && (
        <div className="mt-0.5">
          <ReadReceipt message={message} />
        </div>
      )}

      {message.resolvedReferences && message.resolvedReferences.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {message.resolvedReferences.map((ref) => (
            <ReferenceChip key={`${ref.type}-${ref.id}`} refItem={ref} />
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
                r.mine ? "border-primary-200 bg-primary-50 text-primary-500" : "border-line-hair bg-surface-alt text-ink hover:border-primary-200",
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
            className="inline-flex items-center gap-1.5 rounded-lg border-l-4 border-primary-500 bg-surface-alt px-3 py-2 text-left text-xs font-medium text-primary-500 transition-colors hover:bg-black/5"
          >
            <ReplyIcon className="size-4" />
            {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
          </button>
        </div>
      )}

    </div>
  );
}

/**
 * Consecutive messages from one person within five minutes. The avatar sits at
 * the foot of the run, beside the last bubble; others' names head it.
 */
export function MessageGroup({
  messages,
  currentUserId,
  pinnedIds,
  onJumpToMessage,
  ...actions
}: MessageActionHandlers & {
  messages: ChatMessage[];
  currentUserId: string;
  pinnedIds: Set<string>;
  onJumpToMessage?: (messageId: string) => void;
}) {
  const first = messages[0];
  if (!first) return null;

  const isOwnGroup = first.authorId === currentUserId;
  const authorName = first.authorName ?? "Unknown User";

  return (
    <div className={cn("flex items-end gap-[6px] px-[10px] py-[10px] lg:gap-[8px] lg:px-[16px]", isOwnGroup && "flex-row-reverse")}>
      <Avatar
        name={authorName}
        className="size-[24px] border border-[#EAEAEB] bg-[#F4F4F5] text-[9px] text-[#737373] lg:size-[32px] lg:text-[11px]"
      />
      <div className={cn("flex min-w-0 max-w-[min(640px,calc(100%-36px))] lg:max-w-[min(640px,calc(100%-80px))] flex-col", isOwnGroup ? "items-end" : "items-start")}>
        {isOwnGroup ? null : (
          <span className="h-[20px] truncate text-[12px] font-medium leading-[20px] tracking-[-0.02em] text-[#A1A1A1]">{authorName}</span>
        )}
        {messages.map((m) => (
          <MessageItem
            key={m.id}
            message={m}
            isOwn={m.authorId === currentUserId}
            isPinned={pinnedIds.has(m.id)}
            onJumpToMessage={onJumpToMessage}
            {...actions}
          />
        ))}
      </div>
    </div>
  );
}

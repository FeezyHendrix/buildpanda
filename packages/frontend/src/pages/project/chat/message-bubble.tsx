import { formatClockTime, formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/project-types";
import { LinkText } from "./message-content";
import { FileAttachmentCard, ImageAttachments, splitAttachments } from "./message-attachments";

/** Square, flat bubbles: yours are the brand blue, everyone else's a hairline grey. */
const BUBBLE_TONE = {
  own: "bg-primary text-white",
  other: "border border-[#EDEDED] bg-[#F5F5F5] text-[#1E1E1E]",
} as const;

function MessageTime({ message, own }: { message: ChatMessage; own: boolean }) {
  return (
    <time
      dateTime={message.createdAt}
      title={formatDateTime(message.createdAt)}
      className={cn("shrink-0 text-[11px] leading-[16px] tracking-[-0.02em]", own ? "text-[#99B8F5]" : "text-[#747474]")}
    >
      {formatClockTime(message.createdAt)}
    </time>
  );
}

function MessageText({ message, own }: { message: ChatMessage; own: boolean }) {
  return (
    <span className="min-w-0 whitespace-pre-wrap break-words text-[14px] leading-[20px] tracking-[-0.01em]">
      <LinkText text={message.body} />
      {message.editedAt ? (
        <span className={cn("ml-2 text-[10px]", own ? "text-white/70" : "text-ink-muted")}>(edited)</span>
      ) : null}
    </span>
  );
}

/**
 * The body of one message. Text alone is a single bubble with the time at its
 * end; a message carrying files or images is a padded bubble that holds them,
 * then the caption (if any) and the time.
 */
export function MessageBubble({ message, own }: { message: ChatMessage; own: boolean }) {
  const { images, files } = splitAttachments(message.attachments);
  const hasMedia = images.length > 0 || files.length > 0;
  const hasText = message.body.trim().length > 0;
  const tone = BUBBLE_TONE[own ? "own" : "other"];

  if (!hasMedia) {
    if (!hasText) return null;
    return (
      <div className={cn("max-w-full", tone, own ? "py-[8px] pl-[12px] pr-[16px]" : "py-[7px] pl-[11px] pr-[15px]")}>
        <div className="flex items-end gap-[12px]">
          <MessageText message={message} own={own} />
          <MessageTime message={message} own={own} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex max-w-full flex-col", tone, own ? "p-[4px]" : "p-[3px]")}>
      <ImageAttachments images={images} />
      {files.length > 0 ? (
        <div className="flex flex-col gap-[4px]">
          {files.map((file) => (
            <FileAttachmentCard key={file.fileId} attachment={file} own={own} />
          ))}
        </div>
      ) : null}
      {hasText ? (
        <div className="flex items-end gap-[12px] px-[4px] py-[4px]">
          <MessageText message={message} own={own} />
          <MessageTime message={message} own={own} />
        </div>
      ) : (
        <div className="flex justify-end px-[4px] py-[4px]">
          <MessageTime message={message} own={own} />
        </div>
      )}
    </div>
  );
}

MessageBubble.displayName = "MessageBubble";

import type { ChatMessage } from "@/lib/project-types";
import { FileTextIcon } from "@/components/atoms/chat-icons";

export function AttachmentChip({ attachment }: { attachment: NonNullable<ChatMessage["attachments"]>[0] }) {
  const isImage = (attachment.mime ?? "").startsWith("image/");
  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-h-48 max-w-xs rounded-lg border border-line-hair object-cover"
        />
      </a>
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex w-fit items-center gap-3 rounded-lg border border-line-hair bg-surface-alt px-3 py-2.5 text-xs text-ink transition-colors hover:bg-black/5"
    >
      <span className="flex size-9 items-center justify-center rounded-md bg-white text-ink-muted border border-line">
        <FileTextIcon />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="max-w-[220px] truncate text-sm font-medium text-ink">{attachment.name}</span>
        {attachment.size && (
          <span className="text-xs text-ink-muted">{Math.max(1, Math.round(attachment.size / 1024))} KB</span>
        )}
      </span>
    </a>
  );
}

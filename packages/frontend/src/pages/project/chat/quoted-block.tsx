import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/project-types";

export function QuotedBlock({
  quoted,
  onClick,
  className,
}: {
  quoted: NonNullable<ChatMessage["quotedMessage"]>;
  onClick?: () => void;
  className?: string;
}) {
  const body = quoted.deleted ? "Original message was deleted" : quoted.body;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex w-full max-w-md flex-col items-start gap-0.5 rounded-md border-l-2 border-primary-300 bg-surface-alt px-3 py-1.5 text-left",
        onClick && "transition-colors hover:bg-black/5",
        className,
      )}
    >
      <span className="text-xs font-semibold text-primary-500">
        {quoted.authorName ?? "Unknown"}
      </span>
      <span
        className={cn(
          "line-clamp-2 text-xs text-ink",
          quoted.deleted && "italic text-ink-muted",
        )}
      >
        {body}
      </span>
    </button>
  );
}

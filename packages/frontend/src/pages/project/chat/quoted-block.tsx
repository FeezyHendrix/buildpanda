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
        "flex w-full max-w-md flex-col items-start gap-0.5 rounded-md border-l-2 border-primary-300 bg-gray-50 px-3 py-1.5 text-left",
        onClick && "transition-colors hover:bg-gray-100",
        className,
      )}
    >
      <span className="text-[11px] font-semibold text-primary-500">
        {quoted.authorName ?? "Unknown"}
      </span>
      <span
        className={cn(
          "line-clamp-2 text-xs text-gray-600",
          quoted.deleted && "italic text-gray-400",
        )}
      >
        {body}
      </span>
    </button>
  );
}

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "1 open comment" on a bill row. Pair with `useOpenCommentCounts(sessionId)`:
 * `<OpenCommentBadge count={counts.get(row.id) ?? 0} />`. Renders nothing at 0,
 * so the row clears as soon as its pins are resolved.
 */
export function OpenCommentBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      title={`${count} open comment${count === 1 ? "" : "s"} pinned on the sheet`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-700",
        className,
      )}
    >
      <MessageSquare size={10} strokeWidth={2.5} aria-hidden="true" />
      {count} open comment{count === 1 ? "" : "s"}
    </span>
  );
}
OpenCommentBadge.displayName = "OpenCommentBadge";

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMMENT_MODE, type CommentMode } from "@/lib/markup-meta";

/**
 * Teardrop marker carrying a comment glyph, so pins read as comments at a
 * glance. Shared: a comment sits on a project drawing and on a take-off
 * sheet, and it must look the same on both.
 */
export function CommentPin({
  color,
  label,
  selected,
  draggable,
  dimmed = false,
  onPointerDown,
  onClick,
  style,
}: {
  color: string;
  label: string;
  selected: boolean;
  draggable: boolean;
  /** Resolved, or raised on a superseded revision: still on the sheet, but faded so it reads as closed. */
  dimmed?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}) {
  return (
    <span
      title={label}
      onPointerDown={onPointerDown}
      onClick={onClick}
      style={style}
      className={cn(
        "absolute flex size-7 -translate-x-1/2 -translate-y-full items-center justify-center",
        "rounded-full rounded-bl-sm border-2 border-white text-white shadow-lg",
        draggable ? "cursor-move" : "cursor-pointer",
        dimmed && "opacity-45",
        selected && "ring-2 ring-primary-500 ring-offset-1",
      )}
    >
      <span className="absolute inset-0 rounded-full rounded-bl-sm" style={{ backgroundColor: color }} />
      <MessageSquare size={13} className="relative" strokeWidth={2.5} />
    </span>
  );
}

CommentPin.displayName = "CommentPin";

export function MediaNotePlayer({ url, mode }: { url: string; mode: CommentMode }) {
  if (mode === COMMENT_MODE.VIDEO) {
    return <video src={url} controls playsInline className="mt-2 w-full rounded-md bg-gray-900" />;
  }
  return <audio src={url} controls className="mt-2 w-full" />;
}

MediaNotePlayer.displayName = "MediaNotePlayer";

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMMENT_MODE, type CommentMode } from "./plan-review-comment-types";

/** Teardrop marker carrying a comment glyph, so pins read as comments at a glance. */
export function CommentPin({
  color,
  label,
  selected,
  draggable,
  onPointerDown,
  onClick,
  style,
}: {
  color: string;
  label: string;
  selected: boolean;
  draggable: boolean;
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
        draggable && "cursor-move",
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

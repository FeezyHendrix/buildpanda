import { cn } from "@/lib/utils";

/** A right-clicked vertex or segment of the shape being edited. */
export interface SavedEditMenuTarget {
  kind: "vertex" | "segment";
  index: number;
  /** Screen position inside the canvas container. */
  x: number;
  y: number;
}

interface Props {
  target: SavedEditMenuTarget;
  /** Null when the vertex may be removed; otherwise why not (min-point guard). */
  removeBlockedReason: string | null;
  /** Present only for an INTERIOR vertex of a run: cutting at an end cuts nothing. */
  onSplitHere: (() => void) | null;
  onDeletePoint: () => void;
  /** Null in shape mode: the server's remove-segment indexes the tessellation, not corners. */
  onDeleteSegment: (() => void) | null;
  /** Shape mode: turn this side straight or curved; label carries the direction. */
  onToggleSegment?: { label: string; run: () => void } | null;
  onDeleteMeasurement: () => void;
  onClose: () => void;
}

const ITEM = "flex w-full items-center rounded px-2 py-1.5 text-left text-xs hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent";

/**
 * The explicit deletion menu (contract 16): deleting a point, a segment and the
 * whole measurement are three separately named acts, and a removal the shape's
 * minimum forbids is disabled with its reason rather than deleting the line.
 */
export function SavedEditMenu({ target, removeBlockedReason, onSplitHere, onDeletePoint, onDeleteSegment, onDeleteMeasurement, onToggleSegment = null, onClose }: Props) {
  const item = (action: () => void) => () => {
    action();
    onClose();
  };
  return (
    <div
      data-saved-edit-menu
      className="absolute z-30 w-48 rounded-lg border border-line bg-white p-1 shadow-lg"
      style={{ left: target.x, top: target.y }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {target.kind === "segment" && onToggleSegment ? (
        <button type="button" data-toggle-segment className={ITEM} onClick={item(onToggleSegment.run)}>
          {onToggleSegment.label}
        </button>
      ) : null}
      {target.kind === "vertex" && onSplitHere ? (
        <button type="button" className={ITEM} onClick={item(onSplitHere)}>
          Split here (two lines)
        </button>
      ) : null}
      {target.kind === "vertex" ? (
        <button type="button" className={ITEM} disabled={removeBlockedReason !== null} title={removeBlockedReason ?? undefined} onClick={item(onDeletePoint)}>
          Delete point {target.index + 1}
        </button>
      ) : onDeleteSegment ? (
        <button type="button" className={ITEM} onClick={item(onDeleteSegment)}>
          Delete segment {target.index + 1}
        </button>
      ) : null}
      <button type="button" className={cn(ITEM, "text-red-600 hover:bg-red-50")} onClick={item(onDeleteMeasurement)}>
        Delete measurement
      </button>
    </div>
  );
}
SavedEditMenu.displayName = "SavedEditMenu";

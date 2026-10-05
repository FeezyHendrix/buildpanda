import { Button } from "@/components/atoms/button";

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

const ITEM = "w-full justify-start text-left";

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
      className="absolute z-30 w-48 rounded-none border border-line bg-white p-1 shadow-lg"
      style={{ left: target.x, top: target.y }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {target.kind === "segment" && onToggleSegment ? (
        <Button type="button" size="sm" variant="ghost" data-toggle-segment className={ITEM} onClick={item(onToggleSegment.run)}>
          {onToggleSegment.label}
        </Button>
      ) : null}
      {target.kind === "vertex" && onSplitHere ? (
        <Button type="button" size="sm" variant="ghost" className={ITEM} onClick={item(onSplitHere)}>
          Split here (two lines)
        </Button>
      ) : null}
      {target.kind === "vertex" ? (
        <Button type="button" size="sm" variant="ghost" className={ITEM} disabled={removeBlockedReason !== null} title={removeBlockedReason ?? undefined} onClick={item(onDeletePoint)}>
          Delete point {target.index + 1}
        </Button>
      ) : onDeleteSegment ? (
        <Button type="button" size="sm" variant="ghost" className={ITEM} onClick={item(onDeleteSegment)}>
          Delete segment {target.index + 1}
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="light-danger" className={ITEM} onClick={item(onDeleteMeasurement)}>
        Delete measurement
      </Button>
    </div>
  );
}
SavedEditMenu.displayName = "SavedEditMenu";

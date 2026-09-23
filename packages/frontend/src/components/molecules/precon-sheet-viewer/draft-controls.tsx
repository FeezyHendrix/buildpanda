import { Check, Redo2, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Length and angle of the run's last segment — the live rubber band. */
  readout: { lengthM: number; angleDeg: number } | null;
  /** Non-null for area/volume: the explicit polygon-vs-rectangle choice. */
  areaShape: "polygon" | "rectangle" | null;
  onAreaShape: (mode: "polygon" | "rectangle") => void;
  /** Null when the tool cannot curve; otherwise the visible Straight/Arc mode. */
  arcMode: boolean | null;
  onArcMode: (on: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Null when Finish is allowed; otherwise why it is not (shown as the tooltip). */
  finishBlockedReason: string | null;
  onUndo: () => void;
  onRedo: () => void;
  onFinish: () => void;
  onCancel: () => void;
}

const BUTTON = "flex h-8 items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold";
const GHOST = "text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent";

/**
 * Undo / Redo / Finish / Cancel for the shape being drawn, floating over the
 * bottom-centre of the canvas. Mirrors the keyboard: Backspace or Ctrl/Cmd+Z
 * undo one logical placement, Ctrl/Cmd+Shift+Z redoes, Enter finishes, Esc
 * cancels. Stops mouse events so a click here never lands on the sheet.
 */
export function DraftControls({ readout, areaShape, onAreaShape, arcMode, onArcMode, canUndo, canRedo, finishBlockedReason, onUndo, onRedo, onFinish, onCancel }: Props) {
  return (
    <div
      className="flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-line bg-white p-1 shadow-sm"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {areaShape ? (
        <span className="flex items-center gap-0.5 rounded-md bg-surface-alt p-0.5" role="group" aria-label="Area drawing mode">
          <button type="button" aria-pressed={areaShape === "polygon"} title="Click points; click the first point or press Enter to close" className={cn(BUTTON, areaShape === "polygon" ? "bg-white text-primary-700 shadow-sm" : "text-gray-500")} onClick={() => onAreaShape("polygon")}>
            Polygon
          </button>
          <button type="button" aria-pressed={areaShape === "rectangle"} title="Drag two opposite corners" className={cn(BUTTON, areaShape === "rectangle" ? "bg-white text-primary-700 shadow-sm" : "text-gray-500")} onClick={() => onAreaShape("rectangle")}>
            Rectangle
          </button>
        </span>
      ) : null}
      {arcMode !== null ? (
        <span className="flex items-center gap-0.5 rounded-md bg-surface-alt p-0.5" role="group" aria-label="Segment mode">
          <button type="button" aria-pressed={!arcMode} title="The next click places a straight segment" className={cn(BUTTON, !arcMode ? "bg-white text-primary-700 shadow-sm" : "text-gray-500")} onClick={() => onArcMode(false)}>
            Straight
          </button>
          <button type="button" aria-pressed={arcMode} title="The next click marks the arc's midpoint, the one after its end (same as Alt-click)" className={cn(BUTTON, arcMode ? "bg-white text-primary-700 shadow-sm" : "text-gray-500")} onClick={() => onArcMode(true)}>
            Arc
          </button>
        </span>
      ) : null}
      {readout ? (
        <span data-rubberband className="px-2 font-mono text-xs tabular-nums text-gray-600">
          {readout.lengthM.toFixed(2)} m · {Math.round(readout.angleDeg)}°
        </span>
      ) : null}
      <button type="button" aria-label="Undo last point" title="Undo last point (Backspace or Ctrl+Z)" className={cn(BUTTON, GHOST)} disabled={!canUndo} onClick={onUndo}>
        <Undo2 className="size-4" aria-hidden="true" />
        Undo
      </button>
      <button type="button" aria-label="Redo point" title="Redo (Ctrl+Shift+Z)" className={cn(BUTTON, GHOST)} disabled={!canRedo} onClick={onRedo}>
        <Redo2 className="size-4" aria-hidden="true" />
        Redo
      </button>
      <span className="h-5 w-px bg-line" aria-hidden="true" />
      <button
        type="button"
        aria-label="Finish shape"
        title={finishBlockedReason ?? "Finish (Enter or double-click)"}
        className={cn(BUTTON, "bg-primary-500 text-ink-inverted hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50")}
        disabled={finishBlockedReason !== null}
        onClick={onFinish}
      >
        <Check className="size-4" aria-hidden="true" />
        Finish
      </button>
      <button type="button" aria-label="Cancel drawing" title="Cancel (Esc)" className={cn(BUTTON, GHOST)} onClick={onCancel}>
        <X className="size-4" aria-hidden="true" />
        Cancel
      </button>
    </div>
  );
}
DraftControls.displayName = "DraftControls";

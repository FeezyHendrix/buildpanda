import { Check, Redo2, Undo2, X } from "lucide-react";
import { Button } from "@/components/atoms/button";

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

/**
 * Undo / Redo / Finish / Cancel for the shape being drawn, floating over the
 * bottom-centre of the canvas. Mirrors the keyboard: Backspace or Ctrl/Cmd+Z
 * undo one logical placement, Ctrl/Cmd+Shift+Z redoes, Enter finishes, Esc
 * cancels. Stops mouse events so a click here never lands on the sheet.
 */
export function DraftControls({ readout, areaShape, onAreaShape, arcMode, onArcMode, canUndo, canRedo, finishBlockedReason, onUndo, onRedo, onFinish, onCancel }: Props) {
  return (
    <div
      className="flex max-w-full flex-wrap items-center gap-1 rounded-none border border-line bg-white p-1 shadow-sm"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {areaShape ? (
        <span className="flex items-center gap-0.5 rounded-none bg-surface-alt p-0.5" role="group" aria-label="Area drawing mode">
          <Button type="button" size="sm" variant={areaShape === "polygon" ? "primary" : "ghost"} aria-pressed={areaShape === "polygon"} title="Click points; click the first point or press Enter to close" onClick={() => onAreaShape("polygon")}>
            Polygon
          </Button>
          <Button type="button" size="sm" variant={areaShape === "rectangle" ? "primary" : "ghost"} aria-pressed={areaShape === "rectangle"} title="Drag two opposite corners" onClick={() => onAreaShape("rectangle")}>
            Rectangle
          </Button>
        </span>
      ) : null}
      {arcMode !== null ? (
        <span className="flex items-center gap-0.5 rounded-none bg-surface-alt p-0.5" role="group" aria-label="Segment mode">
          <Button type="button" size="sm" variant={!arcMode ? "primary" : "ghost"} aria-pressed={!arcMode} title="The next click places a straight segment" onClick={() => onArcMode(false)}>
            Straight
          </Button>
          <Button type="button" size="sm" variant={arcMode ? "primary" : "ghost"} aria-pressed={arcMode} title="The next click marks the arc's midpoint, the one after its end (same as Alt-click)" onClick={() => onArcMode(true)}>
            Arc
          </Button>
        </span>
      ) : null}
      {readout ? (
        <span data-rubberband className="px-2 font-mono text-caption-m tabular-nums text-ink-muted">
          {readout.lengthM.toFixed(2)} m · {Math.round(readout.angleDeg)}°
        </span>
      ) : null}
      <Button type="button" size="sm" variant="ghost" aria-label="Undo last point" title="Undo last point (Backspace or Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
        <Undo2 className="size-4" aria-hidden="true" />
        Undo
      </Button>
      <Button type="button" size="sm" variant="ghost" aria-label="Redo point" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}>
        <Redo2 className="size-4" aria-hidden="true" />
        Redo
      </Button>
      <span className="h-5 w-px bg-line" aria-hidden="true" />
      <Button
        type="button"
        size="sm"
        variant="primary"
        aria-label="Finish shape"
        title={finishBlockedReason ?? "Finish (Enter or double-click)"}
        disabled={finishBlockedReason !== null}
        onClick={onFinish}
      >
        <Check className="size-4" aria-hidden="true" />
        Finish
      </Button>
      <Button type="button" size="sm" variant="ghost" aria-label="Cancel drawing" title="Cancel (Esc)" onClick={onCancel}>
        <X className="size-4" aria-hidden="true" />
        Cancel
      </Button>
    </div>
  );
}
DraftControls.displayName = "DraftControls";

import { Crosshair, Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/atoms/button";

interface Props {
  userZoom: number;
  onZoomBy: (factor: number) => void;
  onFit: () => void;
  /** Zooms the view to the selected measurement; absent when nothing is selected. */
  onZoomSelection?: (() => void) | null;
}

const ICON_BUTTON = "size-8 px-0";

function formatZoom(userZoom: number): string {
  return Number.isFinite(userZoom) ? String(Math.round(userZoom * 100)) : "100";
}

/** Zoom out / percentage / zoom in / fit, floating over the bottom-right of the canvas. */
export function ZoomControls({ userZoom, onZoomBy, onFit, onZoomSelection = null }: Props) {
  return (
    <div
      className="flex max-w-full flex-wrap items-center gap-1 rounded-none border border-line bg-white p-1 shadow-sm"
      role="group"
      aria-label="View controls"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <Button type="button" size="sm" variant="ghost" aria-label="Zoom out" title="Zoom out" className={ICON_BUTTON} onClick={() => onZoomBy(1 / 1.5)}>
        <Minus className="size-4" aria-hidden="true" />
      </Button>
      <span className="min-w-12 text-center font-mono text-caption-m tabular-nums text-ink-muted">{formatZoom(userZoom)}%</span>
      <Button type="button" size="sm" variant="ghost" aria-label="Zoom in" title="Zoom in" className={ICON_BUTTON} onClick={() => onZoomBy(1.5)}>
        <Plus className="size-4" aria-hidden="true" />
      </Button>
      <Button type="button" size="sm" variant="ghost" aria-label="Fit to view" title="Fit to view" className={ICON_BUTTON} onClick={onFit}>
        <Maximize2 className="size-4" aria-hidden="true" />
      </Button>
      {onZoomSelection ? (
        <Button type="button" size="sm" variant="ghost" aria-label="Zoom to selection" title="Zoom to the selected measurement" className={ICON_BUTTON} onClick={onZoomSelection}>
          <Crosshair className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
ZoomControls.displayName = "ZoomControls";

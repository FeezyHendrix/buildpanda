import { Maximize2, Minus, Plus } from "lucide-react";

interface Props {
  userZoom: number;
  onZoomBy: (factor: number) => void;
  onFit: () => void;
}

const BUTTON = "flex size-8 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100";

function formatZoom(userZoom: number): string {
  return Number.isFinite(userZoom) ? String(Math.round(userZoom * 100)) : "100";
}

/** Zoom out / percentage / zoom in / fit, floating over the bottom-right of the canvas. */
export function ZoomControls({ userZoom, onZoomBy, onFit }: Props) {
  return (
    <div
      className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-lg border border-line bg-white p-1 shadow-sm"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" aria-label="Zoom out" title="Zoom out" className={BUTTON} onClick={() => onZoomBy(1 / 1.5)}>
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="min-w-12 text-center font-mono text-xs tabular-nums text-gray-600">{formatZoom(userZoom)}%</span>
      <button type="button" aria-label="Zoom in" title="Zoom in" className={BUTTON} onClick={() => onZoomBy(1.5)}>
        <Plus className="size-4" aria-hidden="true" />
      </button>
      <button type="button" aria-label="Fit to view" title="Fit to view" className={BUTTON} onClick={onFit}>
        <Maximize2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
ZoomControls.displayName = "ZoomControls";

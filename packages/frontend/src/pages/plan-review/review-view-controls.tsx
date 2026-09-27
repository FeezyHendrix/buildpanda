import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { IconBtn } from "./plan-review-ui";

const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const ZOOM_STEP = 25;

interface ZoomControlsProps {
  zoom: number;
  onChange: (zoom: number) => void;
  label?: string;
}

/** Used by the review canvas and both comparison panes. */
export function ReviewZoomControls({ zoom, onChange, label = "" }: ZoomControlsProps) {
  const prefix = label ? `${label}: ` : "";
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-white/95 p-1 shadow-sm">
      <IconBtn
        label={`${prefix}Zoom out`}
        disabled={zoom <= MIN_ZOOM}
        onClick={() => onChange(Math.max(MIN_ZOOM, zoom - ZOOM_STEP))}
      >
        <Minus size={15} />
      </IconBtn>
      <span className="w-11 text-center font-mono text-xs text-gray-600">{zoom}%</span>
      <IconBtn
        label={`${prefix}Zoom in`}
        disabled={zoom >= MAX_ZOOM}
        onClick={() => onChange(Math.min(MAX_ZOOM, zoom + ZOOM_STEP))}
      >
        <Plus size={15} />
      </IconBtn>
      <button
        type="button"
        aria-label={`${prefix}Fit to width`}
        onClick={() => onChange(100)}
        className="min-h-9 rounded-md px-2 text-xs font-medium text-gray-600 hover:bg-surface-alt"
      >
        Fit
      </button>
    </div>
  );
}
ReviewZoomControls.displayName = "ReviewZoomControls";

interface PageControlsProps {
  page: number;
  count: number;
  onChange: (page: number) => void;
  label?: string;
}

export function ReviewPageControls({ page, count, onChange, label = "" }: PageControlsProps) {
  if (count <= 1) return null;
  const prefix = label ? `${label}: ` : "";
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-white/95 p-1 shadow-sm">
      <IconBtn label={`${prefix}Previous page`} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={15} />
      </IconBtn>
      <span className="min-w-14 text-center text-xs text-gray-600">
        {page} / {count}
      </span>
      <IconBtn label={`${prefix}Next page`} disabled={page >= count} onClick={() => onChange(page + 1)}>
        <ChevronRight size={15} />
      </IconBtn>
    </div>
  );
}
ReviewPageControls.displayName = "ReviewPageControls";

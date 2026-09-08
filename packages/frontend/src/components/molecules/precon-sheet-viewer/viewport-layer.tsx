import type { SheetViewport } from "@/api/precon";
import { scaleRatioOf } from "@/lib/precon-meta";
import { rectOf } from "./draft-maths";
import type { DragRect } from "./use-draft";

const FRAME_COLOR = "#6B7280";

interface Props {
  widthPx: number;
  heightPx: number;
  viewports: readonly SheetViewport[];
  toPx: (pt: number[]) => [number, number];
  /** The transform wrapper's scale, so labels keep a readable on-screen size. */
  cssZoom: number;
  /** A box being dragged right now (viewport, rectangle area or symbol search). */
  dragRect: DragRect | null;
  dragColor?: string;
  onRemove?: (viewportId: string) => void;
}

/** Canvas-pixel box through two sheet points. */
function pxRect(a: number[], b: number[], toPx: Props["toPx"]): [number, number, number, number] {
  return rectOf(toPx(a), toPx(b));
}

function ViewportFrame({ viewport, toPx, cssZoom, onRemove }: { viewport: SheetViewport; toPx: Props["toPx"]; cssZoom: number; onRemove?: (id: string) => void }) {
  const [x1, y1, x2, y2] = pxRect([viewport.rect[0], viewport.rect[1]], [viewport.rect[2], viewport.rect[3]], toPx);
  const fontSize = 12 / cssZoom;
  const label = `${viewport.label} · 1:${scaleRatioOf(viewport.scaleMmPerPt)}`;
  return (
    <g>
      <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill="none" stroke={FRAME_COLOR} strokeWidth={1.5 / cssZoom} strokeDasharray={`${6 / cssZoom} ${4 / cssZoom}`} opacity={0.6} />
      <text x={x1 + 4 / cssZoom} y={y1 + fontSize + 2 / cssZoom} fontSize={fontSize} fill={FRAME_COLOR} className="select-none">
        {label}
      </text>
      {onRemove ? (
        <text
          x={x1 + 4 / cssZoom + label.length * fontSize * 0.6}
          y={y1 + fontSize + 2 / cssZoom}
          fontSize={fontSize}
          fill={FRAME_COLOR}
          className="pointer-events-auto cursor-pointer select-none hover:fill-red-600"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(viewport.id);
          }}
        >
          <title>Remove this viewport</title>×
        </text>
      ) : null}
    </g>
  );
}
ViewportFrame.displayName = "ViewportFrame";

/**
 * The sheet's viewports as faint labelled frames (a details sheet can carry
 * several scales), and the box the user is dragging right now. Sits over
 * SheetOverlay; only the remove mark takes the pointer.
 */
export function ViewportLayer({ widthPx, heightPx, viewports, toPx, cssZoom, dragRect, dragColor = "#004DE7", onRemove }: Props) {
  const drag = dragRect ? pxRect(dragRect.start, dragRect.current, toPx) : null;
  return (
    <svg className="pointer-events-none absolute left-0 top-0" width={widthPx} height={heightPx} viewBox={`0 0 ${widthPx} ${heightPx}`}>
      {viewports.map((viewport) => (
        <ViewportFrame key={viewport.id} viewport={viewport} toPx={toPx} cssZoom={cssZoom} onRemove={onRemove} />
      ))}
      {drag ? <rect x={drag[0]} y={drag[1]} width={drag[2] - drag[0]} height={drag[3] - drag[1]} fill={dragColor} fillOpacity={0.08} stroke={dragColor} strokeWidth={2 / cssZoom} strokeDasharray={`${4 / cssZoom} ${3 / cssZoom}`} /> : null}
    </svg>
  );
}
ViewportLayer.displayName = "ViewportLayer";

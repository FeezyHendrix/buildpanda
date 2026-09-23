import { useRef } from "react";
import type { PreconGeometry } from "@/api/precon";
import { segmentMidpoints } from "./saved-edit-model";
import { cornersOf, type PathShape } from "./shape-edit-model";
import type { SavedEditState } from "./use-saved-edit";

const HANDLE = "#004DE7";
const DRAG_THRESHOLD_PX = 3;

interface Props {
  widthPx: number;
  heightPx: number;
  /** The selected row's shapes on this sheet — the ones that grow handles. */
  geometries: PreconGeometry[];
  edit: SavedEditState | null;
  toPx: (pt: number[]) => [number, number];
  /** Canvas-px → screen scale, so handles keep a constant on-screen size. */
  cssZoom: number;
  screenToPt: (clientX: number, clientY: number) => [number, number] | null;
  onPickVertex: (geometry: PreconGeometry, index: number) => void;
  onMoveVertex: (index: number, pt: number[]) => void;
  onInsert: (segmentIndex: number, pt: number[]) => void;
  onContextVertex: (geometry: PreconGeometry, index: number, clientX: number, clientY: number) => void;
  onContextSegment: (geometry: PreconGeometry, segmentIndex: number, clientX: number, clientY: number) => void;
  /** Drag an arc's on-curve handle (shape mode only). */
  onBendArc?: (segmentIndex: number, pt: number[]) => void;
  /** The saved logical shape of a not-yet-edited geometry, so handles are corners, not chord points. */
  shapeOf?: (geometry: PreconGeometry) => PathShape | null;
}

/**
 * Constant-size vertex handles over the selected measurement, plus midpoint
 * targets that insert a vertex on the segment. Click selects, drag moves; the
 * working copy (`edit`) previews live while React Query keeps the saved shape.
 */
export function SavedEditLayer({ widthPx, heightPx, geometries, edit, toPx, cssZoom, screenToPt, onPickVertex, onMoveVertex, onInsert, onContextVertex, onContextSegment, onBendArc, shapeOf }: Props) {
  const px = (screen: number) => screen / Math.max(cssZoom, 0.01);
  const dragRef = useRef<{ index: number; startX: number; startY: number; moved: boolean } | null>(null);

  const startDrag = (geometry: PreconGeometry, index: number) => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onPickVertex(geometry, index);
    dragRef.current = { index, startX: e.clientX, startY: e.clientY, moved: false };
    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.moved && Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      const pt = screenToPt(ev.clientX, ev.clientY);
      if (pt) onMoveVertex(drag.index, pt);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startBend = (geometry: PreconGeometry, segmentIndex: number) => (e: React.MouseEvent) => {
    if (e.button !== 0 || !onBendArc) return;
    e.stopPropagation();
    e.preventDefault();
    // entering the edit through the bend handle opens the working copy first
    if (edit?.geometryId !== geometry.id) onPickVertex(geometry, 0);
    const onMove = (ev: MouseEvent) => {
      const pt = screenToPt(ev.clientX, ev.clientY);
      if (pt) onBendArc(segmentIndex, pt);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const shapes = geometries.map((geometry) => {
    const editing = edit?.geometryId === geometry.id;
    // Shape mode: the handles are the LOGICAL corners, not the tessellation —
    // an arc's sixteen chord points are the curve, not sixteen grips. The
    // resolver supplies the shape BEFORE editing starts, so the first click's
    // index is already a corner index.
    const shape = editing ? edit.shape : (shapeOf?.(geometry) ?? null);
    const vertices = shape ? cornersOf(shape) : editing ? edit.vertices : geometry.vertices;
    const closed = geometry.kind === "area" || geometry.kind === "deduction";
    const mids = shape
      ? shape.segments.map((seg, i) => {
          if (seg.kind === "arc") return seg.mid as number[];
          const a = i === 0 ? shape.start : shape.segments[i - 1]!.end;
          return [(a[0] + seg.end[0]) / 2, (a[1] + seg.end[1]) / 2];
        })
      : geometry.kind === "count"
        ? []
        : segmentMidpoints(editing ? edit.vertices : geometry.vertices, closed);
    const preview = editing ? edit.vertices : geometry.vertices;
    return (
      <g key={geometry.id} data-saved-edit={geometry.id} data-geometry-id={geometry.id} role="listbox" aria-label={`Points of the ${geometry.kind} shape`}>
        {editing && geometry.kind !== "count" ? (
          closed ? (
            <polygon points={preview.map((v) => toPx(v).join(",")).join(" ")} fill="none" stroke={HANDLE} strokeWidth={2} strokeDasharray="5 4" />
          ) : (
            <polyline points={preview.map((v) => toPx(v).join(",")).join(" ")} fill="none" stroke={HANDLE} strokeWidth={2} strokeDasharray="5 4" />
          )
        ) : null}
        {mids.map((mid, i) => {
          const [x, y] = toPx(mid);
          const bend = shape?.segments[i]?.kind === "arc";
          return (
            <circle
              key={`mid-${i}`}
              data-insert-handle={bend ? undefined : i}
              data-bend-handle={bend ? i : undefined}
              role="button"
              aria-label={bend ? `Bend side ${i + 1}` : `Add a point on side ${i + 1}`}
              cx={x}
              cy={y}
              r={px(5)}
              fill={bend ? HANDLE : "#fff"}
              stroke={HANDLE}
              strokeWidth={1.5}
              strokeDasharray={bend ? undefined : "2 2"}
              className={bend ? "cursor-move" : "cursor-copy"}
              onMouseDown={bend ? startBend(geometry, i) : (e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (bend) return;
                if (!editing) onPickVertex(geometry, 0);
                onInsert(i, mid);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (edit?.geometryId !== geometry.id) onPickVertex(geometry, 0);
                onContextSegment(geometry, i, e.clientX, e.clientY);
              }}
            />
          );
        })}
        {vertices.map((v, i) => {
          const [x, y] = toPx(v);
          const picked = editing && edit.selectedVertex === i;
          return (
            <rect
              key={`v-${i}`}
              data-vertex-handle={i}
              role="option"
              aria-label={`Point ${i + 1}`}
              aria-selected={picked}
              x={x - px(6)}
              y={y - px(6)}
              width={px(12)}
              height={px(12)}
              rx={px(2)}
              fill={picked ? HANDLE : "#fff"}
              stroke={HANDLE}
              strokeWidth={picked ? 2.5 : 1.5}
              className="cursor-move"
              onMouseDown={startDrag(geometry, i)}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPickVertex(geometry, i);
                onContextVertex(geometry, i, e.clientX, e.clientY);
              }}
            />
          );
        })}
      </g>
    );
  });

  return (
    <svg className="absolute left-0 top-0" width={widthPx} height={heightPx} viewBox={`0 0 ${widthPx} ${heightPx}`} style={{ overflow: "visible", pointerEvents: "none" }}>
      <g style={{ pointerEvents: "auto" }}>{shapes}</g>
    </svg>
  );
}
SavedEditLayer.displayName = "SavedEditLayer";

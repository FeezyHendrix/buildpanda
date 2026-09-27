import { useRef } from "react";
import type { RoomPreview } from "./use-detection-tools";

const COLOR = "#0E7A4A";
const DRAG_THRESHOLD_PX = 3;

interface Props {
  widthPx: number;
  heightPx: number;
  room: RoomPreview;
  toPx: (pt: number[]) => [number, number];
  cssZoom: number;
  screenToPt: (clientX: number, clientY: number) => [number, number] | null;
  onMoveVertex: (index: number, pt: number[]) => void;
}

/**
 * The detected room as an EDITABLE preview: dashed boundary plus draggable
 * corner handles, so a mis-detected corner is repaired before anything is
 * created. Nothing here is persisted — Accept in the banner does that.
 */
export function RoomPreviewLayer({ widthPx, heightPx, room, toPx, cssZoom, screenToPt, onMoveVertex }: Props) {
  const dragRef = useRef<{ index: number; startX: number; startY: number; moved: boolean } | null>(null);
  const px = (screen: number) => screen / Math.max(cssZoom, 0.01);

  const startDrag = (index: number) => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
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

  return (
    <svg className="absolute left-0 top-0" width={widthPx} height={heightPx} viewBox={`0 0 ${widthPx} ${heightPx}`} style={{ overflow: "visible", pointerEvents: "none" }} data-room-preview>
      <polygon
        points={room.vertices.map((v) => toPx(v).join(",")).join(" ")}
        fill={COLOR}
        fillOpacity={0.12}
        stroke={COLOR}
        strokeWidth={2.5}
        strokeDasharray="6 4"
      />
      <g style={{ pointerEvents: "auto" }}>
        {room.vertices.map((v, i) => {
          const [x, y] = toPx(v);
          const picked = room.selectedVertex === i;
          return (
            <rect
              key={i}
              data-room-vertex={i}
              x={x - px(6)}
              y={y - px(6)}
              width={px(12)}
              height={px(12)}
              rx={px(2)}
              fill={picked ? COLOR : "#fff"}
              stroke={COLOR}
              strokeWidth={picked ? 2.5 : 1.5}
              className="cursor-move"
              onMouseDown={startDrag(i)}
              onClick={(e) => e.stopPropagation()}
            />
          );
        })}
      </g>
    </svg>
  );
}
RoomPreviewLayer.displayName = "RoomPreviewLayer";

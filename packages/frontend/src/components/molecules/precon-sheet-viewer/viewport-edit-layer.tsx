import { useRef } from "react";
import { rectOf } from "./draft-maths";

const COLOR = "#B85C00";
const DRAG_THRESHOLD_PX = 3;

export interface RegionEdit {
  id: string;
  label: string;
  ratio: string;
  rect: [number, number, number, number];
}

interface Props {
  widthPx: number;
  heightPx: number;
  edit: RegionEdit;
  toPx: (pt: number[]) => [number, number];
  cssZoom: number;
  screenToPt: (clientX: number, clientY: number) => [number, number] | null;
  onRect: (rect: [number, number, number, number]) => void;
}

/**
 * An existing scale region under edit: four corner handles resize it and a
 * drag inside moves it whole. Nothing is written until the banner's Save runs
 * the impact preview and the apply confirms it.
 */
export function ViewportEditLayer({ widthPx, heightPx, edit, toPx, cssZoom, screenToPt, onRect }: Props) {
  const dragRef = useRef<{ mode: "move" | number; start: [number, number]; rect: [number, number, number, number]; moved: boolean } | null>(null);
  const px = (screen: number) => screen / Math.max(cssZoom, 0.01);
  const [x1, y1, x2, y2] = edit.rect;
  const corners: [number, number][] = [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ];

  const begin = (mode: "move" | number) => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const startPt = screenToPt(e.clientX, e.clientY);
    if (!startPt) return;
    dragRef.current = { mode, start: startPt, rect: [...edit.rect] as [number, number, number, number], moved: false };
    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pt = screenToPt(ev.clientX, ev.clientY);
      if (!pt) return;
      const dx = pt[0] - drag.start[0];
      const dy = pt[1] - drag.start[1];
      if (!drag.moved && Math.hypot(dx, dy) * cssZoom < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      if (drag.mode === "move") {
        onRect([drag.rect[0] + dx, drag.rect[1] + dy, drag.rect[2] + dx, drag.rect[3] + dy]);
        return;
      }
      const next = [...drag.rect] as [number, number, number, number];
      const cornerXs = [0, 2, 2, 0] as const;
      const cornerYs = [1, 1, 3, 3] as const;
      next[cornerXs[drag.mode]!] = drag.rect[cornerXs[drag.mode]!]! + dx;
      next[cornerYs[drag.mode]!] = drag.rect[cornerYs[drag.mode]!]! + dy;
      onRect(rectOf([next[0], next[1]], [next[2], next[3]]));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const [px1, py1] = toPx([x1, y1]);
  const [px2, py2] = toPx([x2, y2]);
  return (
    <svg className="absolute left-0 top-0" width={widthPx} height={heightPx} viewBox={`0 0 ${widthPx} ${heightPx}`} style={{ overflow: "visible", pointerEvents: "none" }} data-viewport-edit>
      <rect
        x={Math.min(px1, px2)}
        y={Math.min(py1, py2)}
        width={Math.abs(px2 - px1)}
        height={Math.abs(py2 - py1)}
        fill={COLOR}
        fillOpacity={0.08}
        stroke={COLOR}
        strokeWidth={2.5}
        className="cursor-move"
        style={{ pointerEvents: "auto" }}
        onMouseDown={begin("move")}
        onClick={(e) => e.stopPropagation()}
      />
      {corners.map((corner, i) => {
        const [cx, cy] = toPx(corner);
        return (
          <rect
            key={i}
            data-region-corner={i}
            x={cx - px(6)}
            y={cy - px(6)}
            width={px(12)}
            height={px(12)}
            fill="#fff"
            stroke={COLOR}
            strokeWidth={2}
            className="cursor-nwse-resize"
            style={{ pointerEvents: "auto" }}
            onMouseDown={begin(i)}
            onClick={(e) => e.stopPropagation()}
          />
        );
      })}
    </svg>
  );
}
ViewportEditLayer.displayName = "ViewportEditLayer";

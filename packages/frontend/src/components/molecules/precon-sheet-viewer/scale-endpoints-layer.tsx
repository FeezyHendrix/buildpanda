import { useRef } from "react";
import type { ScalePrompt } from "./use-scale-prompt";

const COLOR = "#B85C00";

interface Props {
  widthPx: number;
  heightPx: number;
  prompt: ScalePrompt;
  toPx: (pt: number[]) => [number, number];
  cssZoom: number;
  screenToPt: (clientX: number, clientY: number) => [number, number] | null;
  onMovePoint: (which: "from" | "to", pt: [number, number]) => void;
}

/** The drawn scale reference with two draggable endpoints — editing an end invalidates the preview. */
export function ScaleEndpointsLayer({ widthPx, heightPx, prompt, toPx, cssZoom, screenToPt, onMovePoint }: Props) {
  const dragRef = useRef<"from" | "to" | null>(null);
  const px = (screen: number) => screen / Math.max(cssZoom, 0.01);
  const [x1, y1] = toPx(prompt.fromPt);
  const [x2, y2] = toPx(prompt.toPt);

  const startDrag = (which: "from" | "to") => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = which;
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const pt = screenToPt(ev.clientX, ev.clientY);
      if (pt) onMovePoint(dragRef.current, pt);
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
    <svg className="absolute left-0 top-0" width={widthPx} height={heightPx} viewBox={`0 0 ${widthPx} ${heightPx}`} style={{ overflow: "visible", pointerEvents: "none" }} data-scale-endpoints>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLOR} strokeWidth={2.5} strokeDasharray="7 4" />
      {(["from", "to"] as const).map((which) => {
        const [x, y] = which === "from" ? [x1, y1] : [x2, y2];
        return (
          <circle
            key={which}
            data-scale-endpoint={which}
            cx={x}
            cy={y}
            r={px(7)}
            fill="#fff"
            stroke={COLOR}
            strokeWidth={2.5}
            className="cursor-move"
            style={{ pointerEvents: "auto" }}
            onMouseDown={startDrag(which)}
            onClick={(e) => e.stopPropagation()}
          />
        );
      })}
    </svg>
  );
}
ScaleEndpointsLayer.displayName = "ScaleEndpointsLayer";

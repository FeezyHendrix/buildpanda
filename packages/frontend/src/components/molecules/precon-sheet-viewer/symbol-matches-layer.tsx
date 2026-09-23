import type { SymbolReview } from "./detection-model";
import type { SymbolTemplate } from "./use-detection-tools";

const KEPT_COLOR = "#004DE7";
const DROPPED_COLOR = "#9CA3AF";
const MANUAL_COLOR = "#0E7A4A";
const TEMPLATE_COLOR = "#B85C00";

interface LayerProps {
  widthPx: number;
  heightPx: number;
  review: SymbolReview | null;
  template: SymbolTemplate | null;
  toPx: (pt: number[]) => [number, number];
  onToggle: (index: number) => void;
}

/**
 * Find symbol on the sheet: the boxed template awaiting an explicit Search,
 * then every detection as a togglable pin — the one under Prev/Next review is
 * ringed, hand-added markers are green and part of the same count.
 */
export function SymbolMatchesLayer({ widthPx, heightPx, review, template, toPx, onToggle }: LayerProps) {
  return (
    <svg className="pointer-events-none absolute left-0 top-0" width={widthPx} height={heightPx} viewBox={`0 0 ${widthPx} ${heightPx}`}>
      {template ? (
        (() => {
          const [x1, y1] = toPx([template.rect[0], template.rect[1]]);
          const [x2, y2] = toPx([template.rect[2], template.rect[3]]);
          return (
            <rect
              data-symbol-template
              x={Math.min(x1, x2)}
              y={Math.min(y1, y2)}
              width={Math.abs(x2 - x1)}
              height={Math.abs(y2 - y1)}
              fill={TEMPLATE_COLOR}
              fillOpacity={0.1}
              stroke={TEMPLATE_COLOR}
              strokeWidth={2}
              strokeDasharray="5 3"
            />
          );
        })()
      ) : null}
      {review?.points.map((pt, i) => {
        const [x, y] = toPx(pt);
        const dropped = review.dropped.has(i);
        const isCurrent = review.current === i;
        return (
          <g
            key={i}
            data-symbol-match={i}
            className="pointer-events-auto cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(i);
            }}
          >
            <title>{dropped ? "Rejected — click to keep" : "Match — click to reject"}</title>
            {isCurrent ? <circle cx={x} cy={y} r={12} fill="none" stroke={KEPT_COLOR} strokeWidth={1.5} strokeDasharray="2 2" data-current-match /> : null}
            <circle cx={x} cy={y} r={7} fill={dropped ? "none" : KEPT_COLOR} fillOpacity={0.35} stroke={dropped ? DROPPED_COLOR : KEPT_COLOR} strokeWidth={2} strokeDasharray={dropped ? "3 2" : undefined} />
            {dropped ? <path d={`M${x - 3},${y - 3} L${x + 3},${y + 3} M${x + 3},${y - 3} L${x - 3},${y + 3}`} stroke={DROPPED_COLOR} strokeWidth={1.5} /> : null}
          </g>
        );
      })}
      {review?.manual.map((pt, i) => {
        const [x, y] = toPx(pt);
        return (
          <g key={`manual-${i}`} data-manual-marker={i}>
            <title>Added by hand — part of this count</title>
            <circle cx={x} cy={y} r={7} fill={MANUAL_COLOR} fillOpacity={0.4} stroke={MANUAL_COLOR} strokeWidth={2} />
            <path d={`M${x - 3},${y} L${x + 3},${y} M${x},${y - 3} L${x},${y + 3}`} stroke="#fff" strokeWidth={1.5} />
          </g>
        );
      })}
    </svg>
  );
}
SymbolMatchesLayer.displayName = "SymbolMatchesLayer";

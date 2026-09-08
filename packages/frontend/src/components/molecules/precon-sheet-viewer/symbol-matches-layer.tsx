import { Button } from "@/components/atoms/button";

/** Find symbol's answer, with the matches the user has dropped before naming the count. */
export interface SymbolMatches {
  name: string | null;
  points: number[][];
  dropped: ReadonlySet<number>;
}

const KEPT_COLOR = "#004DE7";
const DROPPED_COLOR = "#9CA3AF";

export function keptPoints(matches: SymbolMatches): number[][] {
  return matches.points.filter((_, i) => !matches.dropped.has(i));
}

/** The composer's prefilled description: "<name> × <count>". */
export function symbolDescription(matches: SymbolMatches): string {
  return `${matches.name ?? "Symbol"} × ${keptPoints(matches).length}`;
}

export function toggleMatch(matches: SymbolMatches, index: number): SymbolMatches {
  const dropped = new Set(matches.dropped);
  if (dropped.has(index)) dropped.delete(index);
  else dropped.add(index);
  return { ...matches, dropped };
}

interface LayerProps {
  widthPx: number;
  heightPx: number;
  matches: SymbolMatches;
  toPx: (pt: number[]) => [number, number];
  onToggle: (index: number) => void;
}

/** Pending count pins over the sheet: click one to drop it (or bring it back) before naming the line. */
export function SymbolMatchesLayer({ widthPx, heightPx, matches, toPx, onToggle }: LayerProps) {
  return (
    <svg className="pointer-events-none absolute left-0 top-0" width={widthPx} height={heightPx} viewBox={`0 0 ${widthPx} ${heightPx}`}>
      {matches.points.map((pt, i) => {
        const [x, y] = toPx(pt);
        const dropped = matches.dropped.has(i);
        return (
          <g
            key={i}
            className="pointer-events-auto cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(i);
            }}
          >
            <title>{dropped ? "Dropped — click to keep" : "Match — click to drop"}</title>
            <circle cx={x} cy={y} r={7} fill={dropped ? "none" : KEPT_COLOR} fillOpacity={0.35} stroke={dropped ? DROPPED_COLOR : KEPT_COLOR} strokeWidth={2} strokeDasharray={dropped ? "3 2" : undefined} />
            {dropped ? <path d={`M${x - 3},${y - 3} L${x + 3},${y + 3} M${x + 3},${y - 3} L${x - 3},${y + 3}`} stroke={DROPPED_COLOR} strokeWidth={1.5} /> : null}
          </g>
        );
      })}
    </svg>
  );
}
SymbolMatchesLayer.displayName = "SymbolMatchesLayer";

interface BannerProps {
  matches: SymbolMatches;
  onConfirm: () => void;
  onDiscard: () => void;
}

/** Above the sheet while matches are pending: how many, and how to confirm them as a count line. */
export function SymbolMatchesBanner({ matches, onConfirm, onDiscard }: BannerProps) {
  const kept = keptPoints(matches).length;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-primary-100 bg-primary-50 px-3 py-1.5 text-[11px] text-primary-800">
      <span>
        <span className="font-semibold">{kept}</span> of {matches.points.length} match{matches.points.length === 1 ? "" : "es"} of {matches.name ?? "the symbol"} kept — click a pin to drop it, Enter to name the count
      </span>
      <Button size="sm" disabled={kept === 0} onClick={onConfirm}>
        Count {kept}
      </Button>
      <button type="button" className="underline" onClick={onDiscard}>
        Discard
      </button>
    </div>
  );
}
SymbolMatchesBanner.displayName = "SymbolMatchesBanner";

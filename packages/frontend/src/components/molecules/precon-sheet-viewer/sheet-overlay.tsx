import type { PreconBoqRow, PreconGeometry } from "@/api/precon";
import { getElementStyle } from "./element-styles";

interface Props {
  widthPx: number;
  heightPx: number;
  geometries: PreconGeometry[];
  rowById: Map<string, PreconBoqRow>;
  selectedRowId: string | null;
  onSelectRow: (rowId: string | null) => void;
  draft: number[][];
  draftColor?: string;
  toPx: (pt: number[]) => [number, number];
  /** When set, only these rows draw at full strength; the rest are dimmed. */
  emphasisRowIds?: ReadonlySet<string> | null;
}

function StatusBadge({ at, status }: { at: [number, number]; status: PreconBoqRow["status"] }) {
  if (status !== "verified" && status !== "needs_review") return null;
  const [bx, by] = at;
  return <circle cx={bx} cy={by} r={4} fill={status === "verified" ? "#059669" : "#d97706"} stroke="#fff" strokeWidth={1.5} />;
}
StatusBadge.displayName = "StatusBadge";

function GeometryShape({
  geometry,
  row,
  selected,
  dimmed,
  onPick,
  toPx,
}: {
  geometry: PreconGeometry;
  row: PreconBoqRow;
  selected: boolean;
  dimmed: boolean;
  onPick: (e: React.MouseEvent) => void;
  toPx: Props["toPx"];
}) {
  const stroke = getElementStyle(row.elementGroup).color;
  const pts = geometry.vertices.map(toPx);
  const badge = pts.length > 0 ? <StatusBadge at={pts[0]!} status={row.status} /> : null;
  const opacity = dimmed ? 0.15 : 1;

  if (geometry.kind === "count") {
    return (
      <g onClick={onPick} className="cursor-pointer" opacity={opacity}>
        {pts.map(([x, y], i) => (
          <circle
            key={`${geometry.id}-${i}`}
            cx={x}
            cy={y}
            r={selected ? 7 : 5}
            fill={stroke}
            fillOpacity={0.35}
            stroke={selected ? "#004DE7" : stroke}
            strokeWidth={selected ? 2.5 : 1.5}
          />
        ))}
        {badge}
      </g>
    );
  }
  const path = pts.map(([x, y]) => `${x},${y}`).join(" ");
  if (geometry.kind === "linear") {
    return (
      <g onClick={onPick} className="cursor-pointer" opacity={opacity}>
        {selected ? <polyline points={path} fill="none" stroke="#004DE7" strokeWidth={6} strokeOpacity={0.3} strokeLinecap="round" /> : null}
        <polyline points={path} fill="none" stroke={stroke} strokeWidth={selected ? 3 : 2.5} strokeLinecap="round" />
        {badge}
      </g>
    );
  }
  return (
    <g onClick={onPick} className="cursor-pointer" opacity={opacity}>
      {selected ? <polygon points={path} fill="none" stroke="#004DE7" strokeWidth={4} strokeOpacity={0.3} /> : null}
      <polygon
        points={path}
        fill={stroke}
        fillOpacity={geometry.kind === "deduction" ? 0.08 : 0.15}
        stroke={stroke}
        strokeWidth={selected ? 2.5 : 2}
        strokeDasharray={geometry.kind === "deduction" ? "6 4" : undefined}
      />
      {badge}
    </g>
  );
}
GeometryShape.displayName = "GeometryShape";

/** The measurement overlay drawn over the rasterised sheet, in canvas pixels. */
export function SheetOverlay({ widthPx, heightPx, geometries, rowById, selectedRowId, onSelectRow, draft, draftColor = "#004DE7", toPx, emphasisRowIds = null }: Props) {
  return (
    <svg className="absolute left-0 top-0" width={widthPx} height={heightPx} viewBox={`0 0 ${widthPx} ${heightPx}`}>
      {geometries.map((g) => {
        const row = rowById.get(g.rowId);
        if (!row || row.status === "rejected") return null;
        return (
          <GeometryShape
            key={g.id}
            geometry={g}
            row={row}
            selected={g.rowId === selectedRowId}
            dimmed={emphasisRowIds !== null && !emphasisRowIds.has(g.rowId)}
            toPx={toPx}
            onPick={(e) => {
              e.stopPropagation();
              onSelectRow(g.rowId);
            }}
          />
        );
      })}
      {draft.length > 0 ? (
        <polyline points={draft.map((v) => toPx(v).join(",")).join(" ")} fill="none" stroke={draftColor} strokeWidth={2} strokeDasharray="4 3" />
      ) : null}
      {draft.map((v, i) => {
        const [x, y] = toPx(v);
        return <circle key={i} cx={x} cy={y} r={4} fill={draftColor} />;
      })}
    </svg>
  );
}
SheetOverlay.displayName = "SheetOverlay";

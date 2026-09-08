import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreconBoqRow, PreconGeometry } from "@/api/precon";
import { getElementStyle } from "./element-styles";
import { formatQty, unitLabel } from "./measure-maths";

export interface LegendEntry {
  /** The element group as written on the rows; "Other" when a row has none. */
  group: string;
  color: string;
  shapes: number;
  /** Bill total of the group's lines on this sheet, per unit: "12.4 m · 3 nr". */
  total: string;
  rowIds: string[];
}

/** One entry per element group with geometry on the sheet, alphabetical. */
export function buildLegendEntries(geometries: PreconGeometry[], rowById: Map<string, PreconBoqRow>): LegendEntry[] {
  const byGroup = new Map<string, { color: string; shapes: number; rows: Map<string, PreconBoqRow> }>();
  for (const g of geometries) {
    const row = rowById.get(g.rowId);
    if (!row || row.status === "rejected" || g.kind === "deduction") continue;
    const group = row.elementGroup?.trim() || "Other";
    let entry = byGroup.get(group);
    if (!entry) {
      entry = { color: getElementStyle(row.elementGroup).color, shapes: 0, rows: new Map() };
      byGroup.set(group, entry);
    }
    entry.shapes += 1;
    entry.rows.set(row.id, row);
  }
  // a fresh array from the map, so sorting in place is safe
  return [...byGroup.entries()]
    .map(([group, entry]): LegendEntry => {
      const byUnit = new Map<string, number>();
      for (const row of entry.rows.values()) {
        if (row.qty === null) continue;
        const unit = row.unit ?? "";
        byUnit.set(unit, (byUnit.get(unit) ?? 0) + row.qty);
      }
      const total = [...byUnit.entries()].map(([unit, sum]) => `${formatQty(Math.round(sum * 100) / 100)} ${unitLabel(unit)}`.trim()).join(" · ");
      return { group, color: entry.color, shapes: entry.shapes, total, rowIds: [...entry.rows.keys()] };
    })
    .sort((a, b) => a.group.localeCompare(b.group));
}

interface Props {
  entries: LegendEntry[];
  open: boolean;
  onToggle: () => void;
  /** The group whose geometry is highlighted while everything else is dimmed. */
  activeGroup: string | null;
  onPickGroup: (group: string | null) => void;
}

/** Floating legend: every element group on the sheet, its colour, shape count and total; click to highlight. */
export function SheetLegend({ entries, open, onToggle, activeGroup, onPickGroup }: Props) {
  if (entries.length === 0) return null;
  return (
    <div
      className="absolute bottom-3 left-3 z-10 flex max-w-64 flex-col rounded-lg border border-gray-200 bg-white/95 shadow-sm backdrop-blur"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase text-gray-500 hover:text-gray-700"
      >
        Legend
        <ChevronDown className={cn("ml-2 size-3 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <ul className="flex max-h-48 flex-col overflow-y-auto border-t border-gray-100 p-1">
          {entries.map((entry) => {
            const active = entry.group === activeGroup;
            return (
              <li key={entry.group}>
                <button
                  type="button"
                  aria-pressed={active}
                  title={active ? "Show every group again" : `Highlight ${entry.group} and dim the rest`}
                  onClick={() => onPickGroup(active ? null : entry.group)}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] hover:bg-gray-100",
                    active && "bg-primary-50 text-primary-700 hover:bg-primary-50",
                  )}
                >
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
                  <span className="min-w-0 flex-1 truncate text-gray-700">{entry.group}</span>
                  <span className="shrink-0 text-gray-400">{entry.shapes}</span>
                  <span className="shrink-0 tabular-nums text-gray-600">{entry.total}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
SheetLegend.displayName = "SheetLegend";

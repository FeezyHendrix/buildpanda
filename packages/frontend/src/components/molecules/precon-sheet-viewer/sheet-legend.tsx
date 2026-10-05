import { useState } from "react";
import { ChevronDown, Eye, EyeOff, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/atoms/button";
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

export type LegendScope = "sheet" | "selection" | "session";

/** Per-unit totals of the rows in scope; hidden groups still count (hidden is a view state, not an exclusion). */
export function legendScopeTotal(rows: PreconBoqRow[]): string {
  const byUnit = new Map<string, number>();
  for (const row of rows) {
    if (row.qty === null || row.status === "rejected") continue;
    const unit = row.unit ?? "";
    byUnit.set(unit, (byUnit.get(unit) ?? 0) + row.qty);
  }
  if (byUnit.size === 0) return "—";
  return [...byUnit.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([unit, sum]) => `${formatQty(Math.round(sum * 100) / 100)} ${unitLabel(unit)}`.trim())
    .join(" · ");
}

interface Props {
  entries: LegendEntry[];
  open: boolean;
  onToggle: () => void;
  /** The group whose geometry is highlighted while everything else is dimmed. */
  activeGroup: string | null;
  onPickGroup: (group: string | null) => void;
  /** Groups cleared from the canvas; their rows stay in every total. */
  hiddenGroups?: ReadonlySet<string>;
  onToggleHidden?: (group: string) => void;
  onZoomGroup?: (rowIds: ReadonlySet<string>) => void;
  /** Every row of the session, for the scope totals. */
  allRows?: PreconBoqRow[];
  /** The batch/selected rows, for the "selection" scope. */
  selectionRowIds?: ReadonlySet<string>;
}

const SCOPES: { id: LegendScope; label: string }[] = [
  { id: "sheet", label: "Sheet" },
  { id: "selection", label: "Selection" },
  { id: "session", label: "Take-off" },
];

function ScopeTotals({ entries, allRows, selectionRowIds }: { entries: LegendEntry[]; allRows: PreconBoqRow[]; selectionRowIds: ReadonlySet<string> }) {
  const [scope, setScope] = useState<LegendScope>("sheet");
  const sheetRowIds = new Set(entries.flatMap((e) => e.rowIds));
  const rows =
    scope === "session" ? allRows : scope === "selection" ? allRows.filter((r) => selectionRowIds.has(r.id)) : allRows.filter((r) => sheetRowIds.has(r.id));
  return (
    <div className="border-t border-line-hair px-2 py-1.5" data-legend-totals>
      <div className="flex gap-1">
        {SCOPES.map((s) => (
          <Button
            key={s.id}
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={scope === s.id}
            onClick={() => setScope(s.id)}
            className={cn("h-6 px-1.5 uppercase", scope === s.id ? "bg-primary-50 text-primary-700 hover:bg-primary-50" : "text-ink-muted")}
          >
            {s.label}
          </Button>
        ))}
      </div>
      <p className="mt-1 text-caption-m tabular-nums text-black-500" data-scope={scope}>
        {scope === "selection" && selectionRowIds.size === 0 ? "Nothing selected" : legendScopeTotal(rows)}
      </p>
    </div>
  );
}
ScopeTotals.displayName = "ScopeTotals";

/** Floating legend: every element group on the sheet, its colour, shape count and total; click to highlight. */
export function SheetLegend({ entries, open, onToggle, activeGroup, onPickGroup, hiddenGroups, onToggleHidden, onZoomGroup, allRows, selectionRowIds }: Props) {
  if (entries.length === 0) return null;
  const hiddenCount = hiddenGroups ? entries.filter((e) => hiddenGroups.has(e.group)).length : 0;
  return (
    <div
      className="absolute bottom-14 left-3 z-10 flex max-w-64 flex-col rounded-none border border-line bg-white/95 shadow-sm backdrop-blur"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full justify-between px-2 uppercase text-ink-muted"
      >
        Legend
        <ChevronDown className={cn("ml-2 size-3 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </Button>
      {open ? (
        <ul className="flex max-h-48 flex-col overflow-y-auto border-t border-line-hair p-1">
          {entries.map((entry) => {
            const active = entry.group === activeGroup;
            const hidden = hiddenGroups?.has(entry.group) ?? false;
            return (
              <li key={entry.group} className="group/legend flex items-center">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-pressed={active}
                  title={active ? "Show every group again" : `Highlight ${entry.group} and dim the rest`}
                  onClick={() => onPickGroup(active ? null : entry.group)}
                  className={cn(
                    "h-7 min-w-0 flex-1 justify-start gap-1.5 px-1.5 text-left",
                    active && "bg-primary-50 text-primary-700 hover:bg-primary-50",
                    hidden && "opacity-50",
                  )}
                >
                  <span className="size-2.5 shrink-0 rounded-none" style={{ backgroundColor: entry.color }} />
                  <span className="min-w-0 flex-1 truncate text-black-500">{entry.group}</span>
                  <span className="shrink-0 text-ink-muted">{entry.shapes}</span>
                  <span className="shrink-0 tabular-nums text-ink-muted">{entry.total}</span>
                </Button>
                {onZoomGroup ? (
                  <Button type="button" size="sm" variant="ghost" title={`Zoom to ${entry.group}`} aria-label={`Zoom to ${entry.group}`} className="size-6 shrink-0 px-0 text-ink-muted" onClick={() => onZoomGroup(new Set(entry.rowIds))}>
                    <ZoomIn className="size-3" aria-hidden="true" />
                  </Button>
                ) : null}
                {onToggleHidden ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-pressed={hidden}
                    title={hidden ? `Show ${entry.group} again` : `Hide ${entry.group} on the canvas (still counted)`}
                    aria-label={`${hidden ? "Show" : "Hide"} ${entry.group}`}
                    className="size-6 shrink-0 px-0 text-ink-muted"
                    onClick={() => onToggleHidden(entry.group)}
                  >
                    {hidden ? <EyeOff className="size-3" aria-hidden="true" /> : <Eye className="size-3" aria-hidden="true" />}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {open && hiddenCount > 0 ? (
        <p className="px-2 pb-1 text-caption-s text-warning-500">
          {hiddenCount} group{hiddenCount === 1 ? "" : "s"} hidden — still counted in totals and the bill.
        </p>
      ) : null}
      {open && allRows ? <ScopeTotals entries={entries} allRows={allRows} selectionRowIds={selectionRowIds ?? new Set()} /> : null}
    </div>
  );
}
SheetLegend.displayName = "SheetLegend";

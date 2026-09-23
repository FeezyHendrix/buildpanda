import { useMemo, useState } from "react";
import type { PreconBoqRow, PreconGeometry } from "@/api/precon";
import { rectContains } from "./draft-maths";

export interface BatchTotals {
  shapes: number;
  rows: number;
  /** Summed row quantities per unit, e.g. "31 m2 · 7 m". */
  quantities: string;
}

/**
 * Multi-selection over SAVED shapes: Shift-click toggles one, a Shift-drag
 * marquee adds every shape it touches, a plain click falls back to the single
 * row selection. Selection is geometry-id based (contract 15) and resolved
 * against whatever revision is loaded — never copied state.
 */
export function useBatchSelect(sheetGeometries: PreconGeometry[], rowById: Map<string, PreconBoqRow>) {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());

  const selected = useMemo(() => sheetGeometries.filter((g) => ids.has(g.id)), [sheetGeometries, ids]);
  const rowIds = useMemo(() => [...new Set(selected.map((g) => g.rowId))], [selected]);

  const totals: BatchTotals = useMemo(() => {
    const byUnit = new Map<string, number>();
    for (const rowId of rowIds) {
      const row = rowById.get(rowId);
      if (!row || row.qty === null) continue;
      const unit = row.unit ?? "?";
      byUnit.set(unit, (byUnit.get(unit) ?? 0) + row.qty);
    }
    return {
      shapes: selected.length,
      rows: rowIds.length,
      quantities: [...byUnit.entries()].map(([unit, qty]) => `${Math.round(qty * 100) / 100} ${unit}`).join(" · "),
    };
  }, [selected, rowIds, rowById]);

  const toggle = (geometryId: string) =>
    setIds((current) => {
      const next = new Set(current);
      if (next.has(geometryId)) next.delete(geometryId);
      else next.add(geometryId);
      return next;
    });

  const addRect = (rect: [number, number, number, number]) =>
    setIds((current) => {
      const next = new Set(current);
      for (const g of sheetGeometries) {
        if (g.kind === "deduction") continue;
        if (g.vertices.some((v) => rectContains(rect, v))) next.add(g.id);
      }
      return next;
    });

  return {
    ids,
    selected,
    rowIds,
    totals,
    active: ids.size > 0,
    toggle,
    addRect,
    only: (geometryId: string) => setIds(new Set([geometryId])),
    clear: () => setIds(new Set()),
  };
}

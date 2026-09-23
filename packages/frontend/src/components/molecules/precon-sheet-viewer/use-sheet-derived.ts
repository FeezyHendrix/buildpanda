import { useMemo, useState } from "react";
import type { PreconBoqRow, PreconGeometry } from "@/api/precon";
import { MARKUP_KIND } from "@/api/drawing-markup";
import type { DrawingMarkup } from "@/api/drawing-markup";
import { buildLegendEntries } from "./sheet-legend";

interface Args {
  geometries: PreconGeometry[];
  rows: PreconBoqRow[];
  markups: DrawingMarkup[] | undefined;
  activeSheetId: string | null;
  flashRowId: string | null;
  legendGroup: string | null;
  selectedRowId: string | null;
}

/**
 * Everything the viewer derives from the server state during render: the row
 * index, this sheet's geometries and markups, layer counts, legend entries
 * and which rows read at full strength.
 */
export function useSheetDerived({ geometries, rows, markups, activeSheetId, flashRowId, legendGroup, selectedRowId }: Args) {
  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const sheetGeometries = useMemo(() => geometries.filter((g) => g.sheetId === activeSheetId), [geometries, activeSheetId]);
  const sheetMarkups = useMemo(() => (markups ?? []).filter((m) => m.preconSheetId === activeSheetId), [markups, activeSheetId]);
  // what each toggle would hide, so turning a layer off says what went with it
  const layerCounts = useMemo(
    () => ({
      measurements: sheetGeometries.length,
      ink: sheetMarkups.filter((m) => m.kind === MARKUP_KIND.PEN).length,
      comments: sheetMarkups.filter((m) => m.kind === MARKUP_KIND.PIN).length,
    }),
    [sheetGeometries, sheetMarkups],
  );
  const legendEntries = useMemo(() => buildLegendEntries(sheetGeometries, rowById), [sheetGeometries, rowById]);
  const elementGroups = useMemo(() => [...new Set(rows.flatMap((r) => (r.elementGroup ? [r.elementGroup] : [])))], [rows]);
  // What reads at full strength: a line just created, a legend group, or the
  // line being reviewed. Everything else fades so the selection carries.
  const emphasisRowIds = useMemo(() => {
    if (flashRowId) return new Set([flashRowId]);
    if (legendGroup) return new Set(legendEntries.find((entry) => entry.group === legendGroup)?.rowIds ?? []);
    if (selectedRowId) return new Set([selectedRowId]);
    return null;
  }, [flashRowId, legendGroup, legendEntries, selectedRowId]);

  // Hiding a legend group clears the canvas only — the rows stay in every
  // total and in the bill (hidden is a view state, never an exclusion).
  const [hiddenGroups, setHiddenGroups] = useState<ReadonlySet<string>>(new Set());
  const toggleHiddenGroup = (group: string) =>
    setHiddenGroups((cur) => {
      const next = new Set(cur);
      if (!next.delete(group)) next.add(group);
      return next;
    });
  const visibleGeometries = useMemo(() => {
    if (hiddenGroups.size === 0) return sheetGeometries;
    const hiddenRowIds = new Set(legendEntries.filter((e) => hiddenGroups.has(e.group)).flatMap((e) => e.rowIds));
    return sheetGeometries.filter((g) => !hiddenRowIds.has(g.rowId));
  }, [sheetGeometries, hiddenGroups, legendEntries]);

  return { rowById, sheetGeometries, visibleGeometries, layerCounts, legendEntries, elementGroups, emphasisRowIds, hiddenGroups, toggleHiddenGroup };
}

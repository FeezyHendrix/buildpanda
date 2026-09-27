import { useRef, useState, type RefObject } from "react";
import type { PreconGeometry } from "@/api/precon";
import type { SheetView } from "./use-sheet-view";
import type { useSavedEdit } from "./use-saved-edit";
import type { SavedEditMenuTarget } from "./saved-edit-menu";

const CLICK_SLOP_PX = 4;
const FIT_FRACTION = 0.8;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;

interface Deps {
  tool: string;
  savedEdit: ReturnType<typeof useSavedEdit>;
  containerRef: RefObject<HTMLDivElement | null>;
  selectedRowId: string | null;
  onSelectRow: (rowId: string | null) => void;
  sheetGeometries: PreconGeometry[];
  screenToPt: (clientX: number, clientY: number) => [number, number] | null;
  snapAndOrtho: (pt: [number, number], shift: boolean, prev: number[] | null, bypassSnap?: boolean) => number[];
  toPx: (pt: number[]) => [number, number];
  cssZoom: number;
  view: SheetView;
  setView: (view: SheetView | ((v: SheetView) => SheetView)) => void;
}

/**
 * Select-tool interactions beyond picking a row: clicks that append points in
 * an add mode, clicks on empty sheet that clear the selection (but a pan is
 * not a click), the right-click deletion menu, and zoom-to-selection.
 */
export function useSelectInteractions(deps: Deps) {
  const { savedEdit, containerRef } = deps;
  const [menu, setMenu] = useState<SavedEditMenuTarget | null>(null);
  const pressRef = useRef<[number, number] | null>(null);

  const toContainer = (clientX: number, clientY: number): [number, number] => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect ? [clientX - rect.left, clientY - rect.top] : [clientX, clientY];
  };

  const openMenu = (kind: SavedEditMenuTarget["kind"]) => (_geometry: PreconGeometry, index: number, clientX: number, clientY: number) => {
    const [x, y] = toContainer(clientX, clientY);
    setMenu({ kind, index, x, y });
  };

  const notePress = (e: React.MouseEvent) => {
    pressRef.current = [e.clientX, e.clientY];
  };

  /** True when the select tool consumed the click (nothing should draw). */
  const handleSelectClick = (e: React.MouseEvent): boolean => {
    if (deps.tool !== "select") return false;
    if (menu) {
      setMenu(null);
      return true;
    }
    if (savedEdit.edit?.addingAt) {
      const raw = deps.screenToPt(e.clientX, e.clientY);
      if (raw) {
        const last = savedEdit.edit.addingAt === "start" ? savedEdit.edit.vertices[0] : savedEdit.edit.vertices[savedEdit.edit.vertices.length - 1];
        savedEdit.appendPoint(deps.snapAndOrtho(raw, e.shiftKey, last ?? null, e.ctrlKey || e.metaKey));
      }
      return true;
    }
    // A click on empty sheet clears the selection; a drag-pan must not — shape
    // clicks never reach here (they stop propagation in the overlay).
    const press = pressRef.current;
    const wasClick = press && Math.hypot(e.clientX - press[0], e.clientY - press[1]) < CLICK_SLOP_PX;
    if (wasClick && deps.selectedRowId && !savedEdit.dirty) {
      savedEdit.cancel();
      deps.onSelectRow(null);
      return true;
    }
    return true;
  };

  /** Frame exactly these shapes. One geometry of a multi-shape line, or all of them. */
  const zoomToShapes = (shapes: PreconGeometry[]): void => {
    const container = containerRef.current;
    if (!container || shapes.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const g of shapes) {
      for (const v of g.vertices) {
        const [x, y] = deps.toPx(v);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const bw = Math.max(maxX - minX, 1);
    const bh = Math.max(maxY - minY, 1);
    const targetCss = Math.min(cw / bw, ch / bh) * FIT_FRACTION;
    const userZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, deps.view.userZoom * (targetCss / Math.max(deps.cssZoom, 1e-6))));
    const css = deps.cssZoom * (userZoom / Math.max(deps.view.userZoom, 1e-6));
    deps.setView({
      userZoom,
      tx: (cw - (minX + maxX) * css) / 2,
      ty: (ch - (minY + maxY) * css) / 2,
    });
  };

  const zoomToRows = (rowIds: ReadonlySet<string>) =>
    zoomToShapes(deps.sheetGeometries.filter((g) => rowIds.has(g.rowId)));

  const zoomToGeometry = (geometryId: string) =>
    zoomToShapes(deps.sheetGeometries.filter((g) => g.id === geometryId));

  return { menu, closeMenu: () => setMenu(null), openVertexMenu: openMenu("vertex"), openSegmentMenu: openMenu("segment"), notePress, handleSelectClick, zoomToRows, zoomToGeometry, zoomToSelection: () => zoomToRows(new Set(deps.selectedRowId ? [deps.selectedRowId] : [])) };
}

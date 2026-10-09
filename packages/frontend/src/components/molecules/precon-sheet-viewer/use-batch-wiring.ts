import { useRef, useState } from "react";
import type { PreconBoqRow, PreconGeometry } from "@/api/precon";
import type { EditorCommand } from "@/api/precon-editor";
import { metersToPt } from "./saved-edit-model";
import { nextInStack, stackedHitsAt, type StackCycle } from "./stacked-picker";
import { useBatchOps } from "./use-batch-ops";
import { useBatchSelect } from "./use-batch-select";

interface Args {
  sessionId: string;
  sheetGeometries: PreconGeometry[];
  rowById: Map<string, PreconBoqRow>;
  mmPerPt: number | null;
  onSelectRow: (rowId: string | null) => void;
  setNote: (note: string | null) => void;
  screenToPt?: (clientX: number, clientY: number) => [number, number] | null;
  screenPxToPt?: (px: number) => number;
  cssZoom?: number;
}

/**
 * Task-22 wiring bundled: the multi-selection, the sequential batch runner,
 * the two-click area cut, and the Ctrl/Cmd C-V-D clipboard (copy remembers the
 * selected shape ids; paste and duplicate mint real `duplicate-geometry`
 * operations — nothing lives outside the audit trail).
 */
export function useBatchWiring({ sessionId, sheetGeometries, rowById, mmPerPt, onSelectRow, setNote, screenToPt, screenPxToPt, cssZoom = 1 }: Args) {
  const batch = useBatchSelect(sheetGeometries, rowById);
  const ops = useBatchOps({ sessionId, rowById });
  const [cutting, setCutting] = useState<{ geometry: PreconGeometry; first: number[] | null } | null>(null);
  const clipboardRef = useRef<PreconGeometry[]>([]);
  const cycleRef = useRef<StackCycle | null>(null);
  const [dragDeltaPx, setDragDeltaPx] = useState<[number, number] | null>(null);
  const dragRef = useRef<{ startClient: [number, number]; moved: boolean } | null>(null);

  const pickGeometry = (geometry: PreconGeometry, e: React.MouseEvent) => {
    if (cutting) return;
    if (dragRef.current?.moved) return; // the click that trails a selection drag
    if (e.shiftKey) {
      batch.toggle(geometry.id);
      return;
    }
    // Stacked shapes: every geometry under the click, cycled on repeat clicks
    // at the same spot, so the one below is reachable and the choice explicit.
    const pt = screenToPt?.(e.clientX, e.clientY) ?? null;
    const tol = screenPxToPt?.(8) ?? 3;
    const hits = pt ? stackedHitsAt(pt, sheetGeometries, tol) : [];
    const next = pt && hits.length > 1 ? nextInStack(cycleRef.current, pt, hits, tol) : null;
    batch.clear();
    if (next) {
      cycleRef.current = next.cycle;
      const desc = rowById.get(next.pick.rowId)?.description ?? "";
      setNote(`${hits.length} shapes here — showing ${next.cycle.index + 1} of ${hits.length} (“${desc.slice(0, 40)}”). Click again for the next.`);
      return onSelectRow(next.pick.rowId);
    }
    cycleRef.current = null;
    onSelectRow(geometry.rowId);
  };

  /**
   * Dragging any SELECTED shape moves the whole selection: a live ghost while
   * the button is down, then ONE batch `transform-geometry` receipt on release
   * (one undo). A press on an unselected shape falls through to selection.
   */
  const startSelectionDrag = (geometry: PreconGeometry, e: React.PointerEvent) => {
    if (!batch.ids.has(geometry.id) || e.button !== 0 || cutting) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { startClient: [e.clientX, e.clientY], moved: false };
    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = ev.clientX - drag.startClient[0];
      const dy = ev.clientY - drag.startClient[1];
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      drag.moved = true;
      setDragDeltaPx([dx / cssZoom, dy / cssZoom]);
    };
    const onUp = (ev: PointerEvent) => {
      const drag = dragRef.current;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragDeltaPx(null);
      if (!drag?.moved || !screenToPt) {
        dragRef.current = null;
        return;
      }
      const from = screenToPt(drag.startClient[0], drag.startClient[1]);
      const to = screenToPt(ev.clientX, ev.clientY);
      window.setTimeout(() => {
        dragRef.current = null; // outlive the trailing click
      }, 0);
      if (!from || !to) return;
      const delta: [number, number] = [Math.round((to[0] - from[0]) * 100) / 100, Math.round((to[1] - from[1]) * 100) / 100];
      if (delta[0] === 0 && delta[1] === 0) return;
      const commands: EditorCommand[] = batch.selected.map((g) => ({ kind: "transform-geometry", rowId: g.rowId, geometryId: g.id, translate: delta }));
      void ops.run(commands, ops.expectedRowsFor(batch.selected), `Moved ${commands.length} shape${commands.length === 1 ? "" : "s"} together — one receipt, one undo.`);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startCut = (geometry: PreconGeometry) => {
    setCutting({ geometry, first: null });
    setNote("Cut area: click the two ends of a straight cut across the shape. Both pieces stay on the line.");
  };

  /** True when the click fed the cut line. */
  const captureCutClick = (pt: [number, number]): boolean => {
    if (!cutting) return false;
    if (!cutting.first) {
      setCutting({ ...cutting, first: pt });
      return true;
    }
    const { geometry, first } = cutting;
    setCutting(null);
    setNote(null);
    void ops.run(
      [{ kind: "split-polygon", rowId: geometry.rowId, geometryId: geometry.id, cut: [[first[0]!, first[1]!], pt] }],
      ops.expectedRowsFor([geometry]),
      "Area cut in two; both pieces stay on the line.",
    );
    return true;
  };

  const copy = () => {
    if (!batch.active) return;
    clipboardRef.current = batch.selected;
    setNote(`Copied ${batch.selected.length} shape(s). Paste with Ctrl/Cmd+V.`);
  };

  const pasteOrDuplicate = (shapes: PreconGeometry[]) => {
    if (shapes.length === 0) return;
    const offset = (metersToPt(1, mmPerPt) ?? 20) as number;
    void ops.run(
      shapes.map((g) => ({ kind: "duplicate-geometry", rowId: g.rowId, geometryId: g.id, offset: [offset, -offset] })),
      ops.expectedRowsFor(shapes),
      `Pasted ${shapes.length} shape(s); originals preserved.`,
    );
  };

  return {
    batch,
    ops,
    cutting: cutting !== null,
    pickGeometry,
    startSelectionDrag,
    dragDeltaPx,
    startCut,
    captureCutClick,
    cancelCut: () => setCutting(null),
    copy,
    paste: () => pasteOrDuplicate(clipboardRef.current),
    duplicateSelection: () => pasteOrDuplicate(batch.selected),
  };
}

import { useState } from "react";
import { Button } from "@/components/atoms/button";
import type { PreconBoqRow, PreconGeometry, PreconSheet } from "@/api/precon";
import type { EditorCommand } from "@/api/precon-editor";
import { scaleRatioOf } from "@/lib/precon-meta";
import { metersToPt } from "./saved-edit-model";
import type { useBatchOps } from "./use-batch-ops";
import type { useBatchSelect } from "./use-batch-select";

const FIELD = "h-7 w-16 rounded-md border border-line px-1.5 text-xs tabular-nums";
const LABEL = "flex items-center gap-1 text-xs text-gray-600";

interface Props {
  batch: ReturnType<typeof useBatchSelect>;
  ops: ReturnType<typeof useBatchOps>;
  rows: PreconBoqRow[];
  sheets: PreconSheet[];
  activeSheet: PreconSheet | null;
  rowById: Map<string, PreconBoqRow>;
  onStartCut: (geometry: PreconGeometry) => void;
}

/**
 * The contextual batch bar over a multi-selection: what is selected (count and
 * summed quantities), and every batch act as a visible button — move by exact
 * metres, duplicate with an explicit target sheet and cross-scale mode, merge,
 * reassign to a compatible line, split an area along a drawn cut, delete.
 * Every act is envelope operations pinned to ALL selected line versions.
 */
export function BatchActionBar({ batch, ops, rows, sheets, activeSheet, rowById, onStartCut }: Props) {
  const [dx, setDx] = useState("");
  const [dy, setDy] = useState("");
  const [targetSheetId, setTargetSheetId] = useState("");
  const [crossMode, setCrossMode] = useState<"preserve-real-size" | "retrace">("preserve-real-size");
  const [reassignTo, setReassignTo] = useState("");
  const mmPerPt = activeSheet?.scaleMmPerPt ?? null;
  const expectedRows = ops.expectedRowsFor(batch.selected);
  const selectedRowSet = new Set(batch.rowIds);
  const units = new Set(batch.rowIds.map((id) => rowById.get(id)?.unit ?? "?"));
  const mergeCompatible = batch.rowIds.length >= 2 && units.size === 1;
  const singleRow = batch.rowIds.length === 1 ? (rowById.get(batch.rowIds[0]!) ?? null) : null;
  const singleArea = batch.selected.length === 1 && batch.selected[0]!.kind === "area" ? batch.selected[0]! : null;
  const compatibleTargets = rows.filter((row) => !selectedRowSet.has(row.id) && row.rowType === "item" && (units.size === 0 || units.has(row.unit ?? "?")));

  const toPtDelta = (): [number, number] | null => {
    const x = Number(dx || "0");
    const y = Number(dy || "0");
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) return null;
    const xPt = metersToPt(x, mmPerPt);
    const yPt = metersToPt(y, mmPerPt);
    return xPt === null || yPt === null ? null : [xPt, yPt];
  };

  const move = () => {
    const delta = toPtDelta();
    if (!delta) return;
    const commands: EditorCommand[] = batch.selected.map((g) => ({ kind: "transform-geometry", rowId: g.rowId, geometryId: g.id, translate: delta }));
    void ops.run(commands, expectedRows, `Moved ${commands.length} shape${commands.length === 1 ? "" : "s"} by ${dx || 0} m / ${dy || 0} m.`).then((committed) => {
      if (committed === commands.length) batch.clear();
    });
  };

  const duplicate = () => {
    const offset = (metersToPt(1, mmPerPt) ?? 20) as number;
    const commands: EditorCommand[] = batch.selected.map((g) => ({
      kind: "duplicate-geometry",
      rowId: g.rowId,
      geometryId: g.id,
      offset: [offset, -offset],
      ...(targetSheetId ? { targetSheetId, crossSheet: crossMode } : {}),
    }));
    void ops.run(commands, expectedRows, targetSheetId ? `Copied ${commands.length} shape(s) onto the chosen sheet (${crossMode}).` : `Duplicated ${commands.length} shape(s), originals preserved.`).then((committed) => {
      if (committed === commands.length) batch.clear();
    });
  };

  const merge = () => {
    void ops.run([{ kind: "merge-geometries", rowIds: batch.rowIds }], expectedRows, `Merged ${batch.rowIds.length} lines into one.`).then((committed) => {
      if (committed === 1) batch.clear();
    });
  };

  const reassign = () => {
    if (!reassignTo) return;
    const commands: EditorCommand[] = batch.selected.map((g) => ({ kind: "reassign-geometry", geometryId: g.id, targetRowId: reassignTo }));
    const target = rowById.get(reassignTo);
    const expected = target ? [...expectedRows, { id: target.id, version: target.version }] : expectedRows;
    void ops.run(commands, expected, "Shape(s) billed on the chosen line.").then((committed) => {
      if (committed === commands.length) batch.clear();
    });
  };

  const remove = () => {
    const commands: EditorCommand[] = batch.selected.map((g) => ({ kind: "delete-geometry", geometryId: g.id }));
    void ops.run(commands, expectedRows, `Withdrew ${commands.length} shape(s) — reversible from the history.`).then((committed) => {
      if (committed === commands.length) batch.clear();
    });
  };

  const duplicateRow = () => {
    if (!singleRow) return;
    const offset = (metersToPt(1, mmPerPt) ?? 20) as number;
    // crossSheet is REQUIRED whenever any shape changes drawing; each shape is
    // converted from its OWN source scale (§7), voids follow their parents
    const command: EditorCommand = {
      kind: "duplicate-row",
      rowId: singleRow.id,
      offset: [offset, -offset],
      ...(targetSheetId ? { targetSheetId, crossSheet: crossMode } : {}),
    };
    void ops.run([command], expectedRows, targetSheetId ? `Copied “${singleRow.description}” whole onto the chosen sheet (${crossMode}).` : `Duplicated “${singleRow.description}” whole.`).then((committed) => {
      if (committed === 1) batch.clear();
    });
  };

  return (
    <div className="absolute inset-x-3 top-3 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-2 shadow-lg" data-batch-bar onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <span className="text-xs font-semibold text-gray-900" data-batch-summary>
        {batch.totals.shapes} shape{batch.totals.shapes === 1 ? "" : "s"} on {batch.totals.rows} line{batch.totals.rows === 1 ? "" : "s"}
        {batch.totals.quantities ? ` · ${batch.totals.quantities}` : ""}
      </span>
      <span className="h-5 w-px bg-line" aria-hidden="true" />
      <label className={LABEL}>
        Δx (m)
        <input aria-label="Move x in metres" className={FIELD} value={dx} onChange={(e) => setDx(e.target.value)} />
      </label>
      <label className={LABEL}>
        Δy (m)
        <input aria-label="Move y in metres" className={FIELD} value={dy} onChange={(e) => setDy(e.target.value)} />
      </label>
      <Button size="sm" variant="secondary" loading={ops.busy} disabled={!toPtDelta() || !mmPerPt} title={mmPerPt ? "Move every selected shape by these exact distances" : "This sheet has no scale"} onClick={move}>
        Move
      </Button>
      <span className="h-5 w-px bg-line" aria-hidden="true" />
      <label className={LABEL}>
        Copy to
        <select aria-label="Copy target sheet" className={FIELD} value={targetSheetId} onChange={(e) => setTargetSheetId(e.target.value)}>
          <option value="">this sheet</option>
          {sheets.filter((s) => s.id !== activeSheet?.id && s.status === "measured").map((s) => (
            <option key={s.id} value={s.id}>
              {s.code ?? s.fileName} (1:{s.scaleMmPerPt ? scaleRatioOf(s.scaleMmPerPt) : "?"})
            </option>
          ))}
        </select>
      </label>
      {targetSheetId ? (
        <select aria-label="Cross-sheet scale handling" className={FIELD} value={crossMode} onChange={(e) => setCrossMode(e.target.value as typeof crossMode)}>
          <option value="preserve-real-size">keep real size</option>
          <option value="retrace">retrace at target scale</option>
        </select>
      ) : null}
      <Button size="sm" variant="secondary" loading={ops.busy} onClick={duplicate}>
        Duplicate
      </Button>
      {singleRow ? (
        <Button size="sm" variant="secondary" loading={ops.busy} title="Copy the whole line: every shape and every opening" onClick={duplicateRow}>
          Duplicate line
        </Button>
      ) : null}
      <span className="h-5 w-px bg-line" aria-hidden="true" />
      <Button size="sm" variant="secondary" loading={ops.busy} disabled={!mergeCompatible} title={mergeCompatible ? "Fold the selected lines into one" : "Merge needs 2+ lines with the same unit"} onClick={merge}>
        Merge lines
      </Button>
      <label className={LABEL}>
        Bill on
        <select aria-label="Reassign target line" className={FIELD} value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
          <option value="">choose line…</option>
          {compatibleTargets.map((row) => (
            <option key={row.id} value={row.id}>
              {row.description.slice(0, 30)}
            </option>
          ))}
        </select>
      </label>
      <Button size="sm" variant="secondary" loading={ops.busy} disabled={!reassignTo} onClick={reassign}>
        Reassign
      </Button>
      {singleArea ? (
        <Button size="sm" variant="secondary" title="Draw a straight cut across this area; both pieces stay on the line" onClick={() => onStartCut(singleArea)}>
          Cut area
        </Button>
      ) : null}
      <span className="h-5 w-px bg-line" aria-hidden="true" />
      <Button size="sm" variant="danger" loading={ops.busy} onClick={remove}>
        Delete
      </Button>
      <button type="button" className="text-xs underline" onClick={batch.clear}>
        Clear selection
      </button>
      {ops.note ? <p className="w-full text-xs text-gray-700" data-batch-note>{ops.note}</p> : null}
    </div>
  );
}
BatchActionBar.displayName = "BatchActionBar";

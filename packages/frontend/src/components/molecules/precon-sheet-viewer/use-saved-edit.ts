import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PreconGeometry } from "@/api/precon";
import type { DefinitionConfirmation, EditorCommand } from "@/api/precon-editor";
import { preconApi } from "@/api/precon";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { newOperationId, useEditorOperation } from "@/hooks/use-precon-editor";
import { preconKeys } from "@/hooks/query-keys";
import { addOrOpen, expectedRowsFor, openWorkingCopy, selectOrOpen, type SavedEditState } from "./saved-edit-open";
import {
  SAVED_MIN_VERTICES,
  appendVertex,
  extendedPoint,
  insertVertexAfter,
  metersToPt,
  moveVertex,
  removeVertex,
  type RunEnd,
} from "./saved-edit-model";
import {
  hasArc,
  insertCornerAfter,
  moveArcMid,
  moveCorner,
  removeCorner,
  tessellateShape,
  toggleSegment,
  type PathShape,
} from "./shape-edit-model";

export type { SavedEditState } from "./saved-edit-open";

/** What the server holds after a refused save — shown beside the local copy, never auto-applied. */
export interface SavedEditConflict {
  serverVersion: number;
  serverQty: number | null;
  serverStatus: string | null;
  message: string;
  /** The version the working copy was pinned to, so the panel compares two named versions. */
  baseVersion: number | null;
  /** Exactly what the server refused; Reapply resends THIS, never a rebuilt guess. */
  refused: EditorCommand;
}

interface SavedEditOptions {
  /** The saved logical shape of a geometry, when it records one (else vertex mode). */
  shapeFor?: (geometry: PreconGeometry) => PathShape | null;
  /** The row's version AT THE MOMENT the working copy opens — the pinned baseline. */
  versionOf?: (rowId: string) => number | null;
}

/** Every shape edit re-tessellates the preview so the canvas tracks the curve. */
const withShape = (current: SavedEditState, shape: PathShape): SavedEditState => ({
  ...current,
  shape,
  vertices: tessellateShape(shape),
});

/**
 * Editing a SAVED measurement's shape in a local working copy: pick, move,
 * remove, insert, numerically place, continue a run at either end, add count
 * markers — then one explicit Save sends `update-geometry` through the
 * operation envelope. A refused or failed save keeps the working copy exactly
 * as it stands; a 409 additionally fetches the server's current line so both
 * can be compared, and only an explicit Reapply resends on the fresh version.
 */
export function useSavedEdit(sessionId: string, options?: SavedEditOptions) {
  const [edit, setEdit] = useState<SavedEditState | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [conflict, setConflict] = useState<SavedEditConflict | null>(null);
  const [confirmation, setConfirmation] = useState<DefinitionConfirmation | null>(null);
  const operation = useEditorOperation(sessionId);
  const qc = useQueryClient();

  const patch = (updater: (current: SavedEditState) => SavedEditState) =>
    setEdit((current) => (current ? updater(current) : current));

  /** The curved logical shape to edit, when the row records one (else vertex mode). */
  const curvedShapeOf = (geometry: PreconGeometry): PathShape | null => {
    const shape = options?.shapeFor?.(geometry) ?? null;
    return shape && hasArc(shape) ? shape : null;
  };

  /** Reading the version HERE, once per gesture, is what pins the working copy. */
  const openOn = (geometry: PreconGeometry, vertexIndex: number | null): SavedEditState =>
    openWorkingCopy(geometry, vertexIndex, curvedShapeOf(geometry), options?.versionOf?.(geometry.rowId) ?? null);

  const pickVertex = (geometry: PreconGeometry, vertexIndex: number) => {
    setNote(null);
    const opened = openOn(geometry, vertexIndex);
    setEdit((current) => selectOrOpen(current, geometry.id, vertexIndex, opened));
  };

  const beginAdding = (geometry: PreconGeometry, end: RunEnd) => {
    setNote(null);
    const opened = openOn(geometry, null);
    setEdit((current) => addOrOpen(current, geometry.id, end, opened));
  };

  const appendPoint = (pt: number[]) =>
    patch((current) => (current.addingAt ? { ...current, vertices: appendVertex(current.vertices, pt, current.addingAt) } : current));

  const extendBy = (lengthM: number, angleDeg: number, mmPerPt: number | null) => {
    const lengthPt = metersToPt(lengthM, mmPerPt);
    if (lengthPt === null) return setNote("This sheet has no scale, so a length in metres cannot be placed.");
    patch((current) => {
      const end: RunEnd = current.addingAt ?? (current.selectedVertex === 0 ? "start" : "end");
      const anchor = end === "start" ? current.vertices[0] : current.vertices[current.vertices.length - 1];
      if (!anchor) return current;
      return { ...current, vertices: appendVertex(current.vertices, extendedPoint(anchor, lengthPt, angleDeg), end) };
    });
  };

  const removeSelected = () => {
    if (!edit || edit.selectedVertex === null) return;
    const min = SAVED_MIN_VERTICES[edit.kind];
    if (edit.shape) {
      const next = removeCorner(edit.shape, edit.selectedVertex, min);
      if (next === null) return setNote(`This shape needs at least ${min} points. To take the whole line off the bill, use Delete measurement.`);
      setEdit({ ...withShape(edit, next), selectedVertex: null });
      return setNote(null);
    }
    const next = removeVertex(edit.kind, edit.vertices, edit.selectedVertex);
    if (next === null) {
      setNote(`This shape needs at least ${min} point${min === 1 ? "" : "s"}. To take the whole line off the bill, use Delete measurement.`);
      return;
    }
    setEdit({ ...edit, vertices: next, selectedVertex: null });
    setNote(null);
  };

  const moveTo = (vertexIndex: number, pt: number[]) =>
    patch((current) =>
      current.shape
        ? { ...withShape(current, moveCorner(current.shape, vertexIndex, [pt[0]!, pt[1]!])), selectedVertex: vertexIndex }
        : { ...current, vertices: moveVertex(current.vertices, vertexIndex, pt), selectedVertex: vertexIndex },
    );

  const moveSelectedTo = (x: number, y: number) =>
    patch((current) => {
      if (current.selectedVertex === null) return current;
      if (current.shape) return withShape(current, moveCorner(current.shape, current.selectedVertex, [x, y]));
      return { ...current, vertices: moveVertex(current.vertices, current.selectedVertex, [x, y]) };
    });

  const insertAt = (segmentIndex: number, pt: number[]) =>
    patch((current) =>
      current.shape
        ? { ...withShape(current, insertCornerAfter(current.shape, segmentIndex, [pt[0]!, pt[1]!])), selectedVertex: segmentIndex + 1 }
        : { ...current, vertices: insertVertexAfter(current.vertices, segmentIndex, pt), selectedVertex: segmentIndex + 1 },
    );

  /** Drag the arc's on-curve handle: the side bends, endpoints stay put. */
  const bendArc = (segmentIndex: number, pt: number[]) =>
    patch((current) => (current.shape ? withShape(current, moveArcMid(current.shape, segmentIndex, [pt[0]!, pt[1]!])) : current));

  /** Straight ↔ curved on one side of the logical shape. */
  const toggleSegmentKind = (segmentIndex: number) =>
    patch((current) => (current.shape ? withShape(current, toggleSegment(current.shape, segmentIndex)) : current));

  const dirty =
    edit !== null &&
    (edit.shape
      ? JSON.stringify(edit.shape) !== JSON.stringify(edit.baseShape)
      : JSON.stringify(edit.vertices) !== JSON.stringify(edit.baseVertices));

  const onRefused = async (error: unknown, current: SavedEditState, refused: EditorCommand) => {
    if (getApiErrorStatus(error) === 409) {
      void qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
      const snapshot = await preconApi.snapshot(sessionId).catch(() => null);
      const serverRow = snapshot?.rows.find((r) => r.id === current.rowId) ?? null;
      setConflict({
        serverVersion: serverRow?.version ?? -1,
        serverQty: serverRow?.qty ?? null,
        serverStatus: serverRow?.status ?? null,
        message: getApiErrorMessage(error, "Someone else changed this line."),
        baseVersion: current.baseVersion,
        refused,
      });
      return;
    }
    setNote(getApiErrorMessage(error, "Could not save the edited shape — your edit is kept; retry or cancel."));
  };

  /**
   * One envelope for every command this working copy sends, version-checked
   * against `atVersion` — the pinned baseline, or the version the conflict
   * panel showed when the user explicitly reapplies. A refusal keeps the
   * working copy exactly as it stands.
   */
  const send = (command: EditorCommand, at: { current: SavedEditState; operationId: string; atVersion: number | null }) => {
    setConflict(null);
    operation.mutate(
      {
        operationId: at.operationId,
        expectedRows: expectedRowsFor(at.current.rowId, at.atVersion),
        command,
      },
      {
        onSuccess: () => {
          setEdit(null);
          setNote(null);
          setConfirmation(null);
        },
        onError: (error) => void onRefused(error, at.current, command),
      },
    );
  };

  const save = () => {
    if (!edit || !dirty) return;
    // reused across retries of the SAME gesture so a timed-out save lands once
    const operationId = edit.operationId ?? newOperationId();
    const { geometryId, vertices, shape } = edit;
    const current = { ...edit, operationId };
    setEdit(current);
    send(
      // the SHAPE is authoritative for a curved edit; vertices would restate it as chords
      { kind: "update-geometry", geometryId, ...(shape ? { shape } : { vertices }), ...(confirmation ? { confirm: confirmation } : {}) },
      { current, operationId, atVersion: current.baseVersion },
    );
  };

  /**
   * Resend the command the server refused, on the exact version the conflict
   * panel compared against — never the cache's, never a rebuilt command. The
   * local working copy is untouched until the resend succeeds, so a second
   * refusal still leaves the edit on screen. Only ever explicit.
   */
  const reapply = () => {
    if (!edit || !conflict || conflict.serverVersion <= 0) return;
    send(conflict.refused, { current: edit, operationId: newOperationId(), atVersion: conflict.serverVersion });
  };

  const deleteMeasurement = () => {
    if (!edit) return;
    send({ kind: "delete-geometry", geometryId: edit.geometryId }, { current: edit, operationId: newOperationId(), atVersion: edit.baseVersion });
  };

  const splitAt = (vertexIndex: number) => {
    if (!edit) return;
    send(
      { kind: "split-polyline", rowId: edit.rowId, geometryId: edit.geometryId, vertexIndex },
      { current: edit, operationId: newOperationId(), atVersion: edit.baseVersion },
    );
  };

  const deleteSegment = (segmentIndex: number) => {
    if (!edit) return;
    send(
      { kind: "remove-segment", rowId: edit.rowId, geometryId: edit.geometryId, segmentIndex },
      { current: edit, operationId: newOperationId(), atVersion: edit.baseVersion },
    );
  };

  const cancel = () => {
    setEdit(null);
    setNote(null);
    setConflict(null);
  };

  return {
    edit,
    dirty,
    note,
    conflict,
    confirmation,
    setConfirmation,
    saving: operation.isPending,
    pickVertex,
    beginAdding,
    bendArc,
    toggleSegmentKind,
    appendPoint,
    extendBy,
    removeSelected,
    moveTo,
    moveSelectedTo,
    insertAt,
    save,
    reapply,
    deleteMeasurement,
    deleteSegment,
    splitAt,
    cancel,
  };
}

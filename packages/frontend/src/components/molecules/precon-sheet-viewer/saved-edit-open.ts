import type { PreconGeometry } from "@/api/precon";
import type { VersionedRef } from "@/api/precon-editor";
import type { RunEnd } from "./saved-edit-model";
import type { PathShape } from "./shape-edit-model";

/** A saved shape being corrected: the working copy the canvas previews. */
export interface SavedEditState {
  geometryId: string;
  rowId: string;
  /**
   * The row version this working copy was opened on — the optimistic-concurrency
   * baseline for EVERY command it sends (save, delete, split, remove segment).
   * Never re-read from the React Query row: realtime invalidation keeps that
   * cache on the server's latest version, so a stale tab resubmitting against it
   * would pass the version check and silently overwrite a colleague's committed
   * edit. Pinned here, the same stale tab is refused with a 409 instead.
   */
  baseVersion: number | null;
  kind: PreconGeometry["kind"];
  baseVertices: number[][];
  vertices: number[][];
  /**
   * Present when the saved measurement carries a CURVED logical shape: edits
   * then happen on this working copy (corners + arc mids), `vertices` is its
   * display tessellation, and Save sends the shape — never chord vertices.
   */
  shape: PathShape | null;
  baseShape: PathShape | null;
  selectedVertex: number | null;
  /** Clicks on the sheet append points here instead of selecting (count markers, run continuation). */
  addingAt: RunEnd | null;
  /** Minted on the first save attempt and reused on retry, so a timed-out save lands once. */
  operationId: string | null;
}

/** A working copy of `geometry` as it stands on the server, pinned to `baseVersion`. */
export function openWorkingCopy(
  geometry: PreconGeometry,
  vertexIndex: number | null,
  shape: PathShape | null,
  baseVersion: number | null,
): SavedEditState {
  return {
    geometryId: geometry.id,
    rowId: geometry.rowId,
    baseVersion,
    kind: geometry.kind,
    baseVertices: geometry.vertices.map((v) => [...v]),
    vertices: geometry.vertices.map((v) => [...v]),
    shape,
    baseShape: shape,
    selectedVertex: vertexIndex,
    addingAt: null,
    operationId: null,
  };
}

/**
 * Picking a point: another point of the SAME shape only moves the selection,
 * so the pinned version and the edits made so far survive. Only a different
 * shape adopts the freshly opened copy — which is what re-pins the version.
 */
export function selectOrOpen(current: SavedEditState | null, geometryId: string, vertexIndex: number, opened: SavedEditState): SavedEditState {
  return current && current.geometryId === geometryId ? { ...current, selectedVertex: vertexIndex, addingAt: null } : opened;
}

/** Toggling an add-at-end mode follows the same rule: same shape, same working copy, same pin. */
export function addOrOpen(current: SavedEditState | null, geometryId: string, end: RunEnd, opened: SavedEditState): SavedEditState {
  return current && current.geometryId === geometryId
    ? { ...current, addingAt: current.addingAt === end ? null : end, selectedVertex: null }
    : { ...opened, addingAt: end };
}

/**
 * What an editor command pins its optimistic-concurrency check to. An unknown
 * baseline sends no check at all rather than inventing one — a guessed version
 * is what silently overwrites a colleague.
 */
export function expectedRowsFor(rowId: string, version: number | null): VersionedRef[] {
  return version === null ? [] : [{ id: rowId, version }];
}

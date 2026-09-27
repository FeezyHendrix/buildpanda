import { removeVertex } from "./saved-edit-model";
import { analyticLengthPt } from "./shape-edit-model";
import { SavedEditMenu } from "./saved-edit-menu";
import { ConflictPanel, VertexInputsPanel } from "./saved-edit-panels";
import type { useSavedEdit } from "./use-saved-edit";
import type { useSelectInteractions } from "./use-select-interactions";

interface Props {
  savedEdit: ReturnType<typeof useSavedEdit>;
  select: ReturnType<typeof useSelectInteractions>;
  /** The scale the working copy is measured with; null on an unscaled sheet. */
  editScale: number | null;
}

/** The straight-shape preview: how many points the working copy now holds, and whether it is unsaved. */
function workingCopyReadout(pointCount: number, dirty: boolean): string {
  const points = `${pointCount} point${pointCount === 1 ? "" : "s"}`;
  return dirty ? `Editing shape — ${points}, unsaved` : `Editing shape — ${points}`;
}

/**
 * The floating layers of a saved-shape edit: the right-click deletion menu,
 * the 409 conflict comparison, and the numeric no-drag inputs. At most one of
 * the panels shows — a conflict outranks the inputs.
 */
export function SavedEditOverlays({ savedEdit, select, editScale }: Props) {
  const edit = savedEdit.edit;
  if (!edit) return null;
  const segmentKind = select.menu?.kind === "segment" ? edit.shape?.segments[select.menu.index]?.kind : undefined;
  // TRUE analytic figure while a curved shape is edited — never a chord sum.
  // A closed area's figure needs the server's circular-segment mathematics,
  // so it is stated as pending rather than faked.
  const analytic =
    edit.shape && editScale !== null
      ? edit.shape.closed
        ? "Area: computed by the server on save"
        : `Length ${((analyticLengthPt(edit.shape) * editScale) / 1000).toFixed(2)} m (analytic, arcs as r·θ)`
      : edit.shape
        ? "No scale on this sheet — the server measures on save"
        : null;
  return (
    <>
      <p
        data-analytic-readout
        role="status"
        aria-live="polite"
        aria-label="Shape being edited"
        className="absolute left-1/2 top-16 z-20 max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-md border border-line bg-white px-2.5 py-1 text-center text-xs font-medium tabular-nums text-gray-800 shadow-sm"
      >
        {analytic ?? workingCopyReadout(edit.vertices.length, savedEdit.dirty)}
      </p>
      {select.menu ? (
        <SavedEditMenu
          target={select.menu}
          removeBlockedReason={
            select.menu.kind === "vertex" && removeVertex(edit.kind, edit.vertices, select.menu.index) === null
              ? "This shape is at its minimum number of points"
              : null
          }
          onSplitHere={
            // shape mode indexes CORNERS; the server's split/remove-segment
            // commands index the stored tessellation, so they are withheld
            // there (edit the shape instead)
            !edit.shape && edit.kind === "linear" && select.menu.kind === "vertex" && select.menu.index > 0 && select.menu.index < edit.vertices.length - 1
              ? () => savedEdit.splitAt(select.menu!.index)
              : null
          }
          onDeletePoint={savedEdit.removeSelected}
          onDeleteSegment={edit.shape ? null : () => savedEdit.deleteSegment(select.menu!.index)}
          onToggleSegment={
            segmentKind
              ? { label: segmentKind === "arc" ? "Make this side straight" : "Make this side an arc", run: () => savedEdit.toggleSegmentKind(select.menu!.index) }
              : null
          }
          onDeleteMeasurement={savedEdit.deleteMeasurement}
          onClose={select.closeMenu}
        />
      ) : null}
      {savedEdit.conflict ? (
        <ConflictPanel
          conflict={savedEdit.conflict}
          localVertexCount={edit.vertices.length}
          reapplying={savedEdit.saving}
          onReapply={savedEdit.reapply}
          onDiscard={savedEdit.cancel}
        />
      ) : edit.selectedVertex !== null || edit.addingAt ? (
        <VertexInputsPanel
          key={`${edit.geometryId}:${edit.selectedVertex}:${edit.addingAt}`}
          edit={edit}
          mmPerPt={editScale}
          onMoveSelectedTo={savedEdit.moveSelectedTo}
          onExtendBy={(lengthM, angleDeg) => savedEdit.extendBy(lengthM, angleDeg, editScale)}
        />
      ) : null}
    </>
  );
}
SavedEditOverlays.displayName = "SavedEditOverlays";

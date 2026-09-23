import type { PreconGeometry } from "@/api/precon";
import { DraftControls } from "./draft-controls";
import { PersistedHistoryControls, SavedEditControls } from "./saved-edit-controls";
import type { useDraft } from "./use-draft";
import type { useOpHistory } from "./use-op-history";
import type { useSavedEdit } from "./use-saved-edit";

interface Props {
  draftApi: ReturnType<typeof useDraft>;
  savedEdit: ReturnType<typeof useSavedEdit>;
  opHistory: ReturnType<typeof useOpHistory>;
  draftControlsOn: boolean;
  historyControlsOn: boolean;
  finishBlockedReason: string | null;
  readout: { lengthM: number; angleDeg: number } | null;
  areaShape: "polygon" | "rectangle" | null;
  onAreaShape: (mode: "polygon" | "rectangle") => void;
  arcMode: boolean | null;
  onArcMode: (on: boolean) => void;
  editGeometry: PreconGeometry | null;
  onFinish: () => void;
  onCancel: () => void;
}

/**
 * Which bar floats over the canvas: the draft's Undo/Redo/Finish/Cancel while
 * drawing, the saved shape's Remove/Save/Cancel while correcting one, or the
 * persisted Undo/Redo when idle with reversible edits.
 */
export function CanvasControlBars({ draftApi, savedEdit, opHistory, draftControlsOn, historyControlsOn, finishBlockedReason, readout, areaShape, onAreaShape, arcMode, onArcMode, editGeometry, onFinish, onCancel }: Props) {
  if (draftControlsOn) {
    return (
      <DraftControls
        readout={readout}
        areaShape={areaShape}
        onAreaShape={onAreaShape}
        arcMode={arcMode}
        onArcMode={onArcMode}
        canUndo={draftApi.canUndo}
        canRedo={draftApi.canRedo}
        finishBlockedReason={finishBlockedReason}
        onUndo={draftApi.undo}
        onRedo={draftApi.redo}
        onFinish={onFinish}
        onCancel={onCancel}
      />
    );
  }
  if (savedEdit.edit) {
    return (
      <SavedEditControls
        vertexSelected={savedEdit.edit.selectedVertex !== null}
        dirty={savedEdit.dirty}
        saving={savedEdit.saving}
        kind={savedEdit.edit.kind}
        addingAt={savedEdit.edit.addingAt}
        onToggleAdd={(end) => {
          if (editGeometry) savedEdit.beginAdding(editGeometry, end);
        }}
        onRemoveVertex={savedEdit.removeSelected}
        onDeleteMeasurement={savedEdit.deleteMeasurement}
        onSave={savedEdit.save}
        onCancel={savedEdit.cancel}
      />
    );
  }
  if (historyControlsOn && (opHistory.canUndo || opHistory.canRedo)) {
    return (
      <PersistedHistoryControls
        canUndo={opHistory.canUndo}
        canRedo={opHistory.canRedo}
        busy={opHistory.busy}
        undoBlockedReason={opHistory.undoBlockedReason}
        onUndo={opHistory.undo}
        onRedo={opHistory.redo}
      />
    );
  }
  return null;
}
CanvasControlBars.displayName = "CanvasControlBars";

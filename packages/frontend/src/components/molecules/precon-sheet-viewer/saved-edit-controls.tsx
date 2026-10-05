import { Check, ListPlus, Redo2, Trash2, Undo2, X } from "lucide-react";
import type { RunEnd } from "./saved-edit-model";
import { Button } from "@/components/atoms/button";

const BAR = "flex max-w-full flex-wrap items-center gap-1 rounded-none border border-line bg-white p-1 shadow-sm";

interface SavedEditProps {
  vertexSelected: boolean;
  dirty: boolean;
  saving: boolean;
  kind: string;
  addingAt: RunEnd | null;
  onToggleAdd: (end: RunEnd) => void;
  onRemoveVertex: () => void;
  onDeleteMeasurement: () => void;
  onSave: () => void;
  onCancel: () => void;
}

/** Save / Cancel / Remove point / Add points for a saved shape being corrected. */
export function SavedEditControls({ vertexSelected, dirty, saving, kind, addingAt, onToggleAdd, onRemoveVertex, onDeleteMeasurement, onSave, onCancel }: SavedEditProps) {
  return (
    <div className={BAR} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      {kind === "count" ? (
        <Button type="button" size="sm" variant={addingAt === "end" ? "primary" : "ghost"} aria-label="Add markers" title="Click the sheet to add markers to this count" aria-pressed={addingAt === "end"} onClick={() => onToggleAdd("end")}>
          <ListPlus className="size-4" aria-hidden="true" />
          Add markers
        </Button>
      ) : kind === "linear" ? (
        <>
          <Button type="button" size="sm" variant={addingAt === "start" ? "primary" : "ghost"} aria-label="Continue at start" title="Click the sheet to add points before the first" aria-pressed={addingAt === "start"} onClick={() => onToggleAdd("start")}>
            <ListPlus className="size-4 -scale-x-100" aria-hidden="true" />
            Start
          </Button>
          <Button type="button" size="sm" variant={addingAt === "end" ? "primary" : "ghost"} aria-label="Continue at end" title="Click the sheet to add points after the last" aria-pressed={addingAt === "end"} onClick={() => onToggleAdd("end")}>
            <ListPlus className="size-4" aria-hidden="true" />
            End
          </Button>
        </>
      ) : null}
      <Button type="button" size="sm" variant="ghost" aria-label="Remove point" title="Remove the selected point (Delete)" disabled={!vertexSelected} onClick={onRemoveVertex}>
        <Trash2 className="size-4" aria-hidden="true" />
        Remove point
      </Button>
      <Button type="button" size="sm" variant="light-danger" aria-label="Delete measurement" title="Take the whole line off the bill (reversible)" onClick={onDeleteMeasurement}>
        <Trash2 className="size-4" aria-hidden="true" />
        Delete measurement
      </Button>
      <span className="h-5 w-px bg-line" aria-hidden="true" />
      <Button
        type="button"
        size="sm"
        variant="primary"
        aria-label="Save shape"
        title="Save the corrected shape"
        loading={saving}
        disabled={!dirty || saving}
        onClick={onSave}
      >
        <Check className="size-4" aria-hidden="true" />
        Save shape
      </Button>
      <Button type="button" size="sm" variant="ghost" aria-label="Cancel shape edit" title="Cancel — the saved shape is untouched (Esc)" onClick={onCancel}>
        <X className="size-4" aria-hidden="true" />
        Cancel
      </Button>
    </div>
  );
}
SavedEditControls.displayName = "SavedEditControls";

interface HistoryProps {
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
  /** Why undo is unavailable (a colleague's edit, nothing to undo) — the tooltip. */
  undoBlockedReason: string | null;
  onUndo: () => void;
  onRedo: () => void;
}

/** Undo / Redo over SAVED edits, addressed through the audit trail. */
export function PersistedHistoryControls({ canUndo, canRedo, busy, undoBlockedReason, onUndo, onRedo }: HistoryProps) {
  return (
    <div className={BAR} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <Button type="button" size="sm" variant="ghost" aria-label="Undo saved edit" title={undoBlockedReason ?? "Undo the last saved edit (Ctrl+Z)"} disabled={!canUndo || busy} onClick={onUndo}>
        <Undo2 className="size-4" aria-hidden="true" />
        Undo
      </Button>
      <Button type="button" size="sm" variant="ghost" aria-label="Redo saved edit" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo || busy} onClick={onRedo}>
        <Redo2 className="size-4" aria-hidden="true" />
        Redo
      </Button>
    </div>
  );
}
PersistedHistoryControls.displayName = "PersistedHistoryControls";

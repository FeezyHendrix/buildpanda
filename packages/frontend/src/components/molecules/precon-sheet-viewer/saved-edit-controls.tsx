import { Check, ListPlus, Redo2, Trash2, Undo2, X } from "lucide-react";
import type { RunEnd } from "./saved-edit-model";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/atoms/spinner";

const BUTTON = "flex h-8 items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold";
const GHOST = "text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent";
const BAR = "flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-line bg-white p-1 shadow-sm";

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

const ACTIVE = "bg-primary-50 text-primary-700";

/** Save / Cancel / Remove point / Add points for a saved shape being corrected. */
export function SavedEditControls({ vertexSelected, dirty, saving, kind, addingAt, onToggleAdd, onRemoveVertex, onDeleteMeasurement, onSave, onCancel }: SavedEditProps) {
  return (
    <div className={BAR} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      {kind === "count" ? (
        <button type="button" aria-label="Add markers" title="Click the sheet to add markers to this count" aria-pressed={addingAt === "end"} className={cn(BUTTON, GHOST, addingAt === "end" && ACTIVE)} onClick={() => onToggleAdd("end")}>
          <ListPlus className="size-4" aria-hidden="true" />
          Add markers
        </button>
      ) : kind === "linear" ? (
        <>
          <button type="button" aria-label="Continue at start" title="Click the sheet to add points before the first" aria-pressed={addingAt === "start"} className={cn(BUTTON, GHOST, addingAt === "start" && ACTIVE)} onClick={() => onToggleAdd("start")}>
            <ListPlus className="size-4 -scale-x-100" aria-hidden="true" />
            Start
          </button>
          <button type="button" aria-label="Continue at end" title="Click the sheet to add points after the last" aria-pressed={addingAt === "end"} className={cn(BUTTON, GHOST, addingAt === "end" && ACTIVE)} onClick={() => onToggleAdd("end")}>
            <ListPlus className="size-4" aria-hidden="true" />
            End
          </button>
        </>
      ) : null}
      <button type="button" aria-label="Remove point" title="Remove the selected point (Delete)" className={cn(BUTTON, GHOST)} disabled={!vertexSelected} onClick={onRemoveVertex}>
        <Trash2 className="size-4" aria-hidden="true" />
        Remove point
      </button>
      <button type="button" aria-label="Delete measurement" title="Take the whole line off the bill (reversible)" className={cn(BUTTON, "text-red-600 hover:bg-red-50")} onClick={onDeleteMeasurement}>
        <Trash2 className="size-4" aria-hidden="true" />
        Delete measurement
      </button>
      <span className="h-5 w-px bg-line" aria-hidden="true" />
      <button
        type="button"
        aria-label="Save shape"
        aria-busy={saving || undefined}
        title="Save the corrected shape"
        className={cn(BUTTON, "relative bg-primary-500 text-ink-inverted hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50")}
        disabled={!dirty || saving}
        onClick={onSave}
      >
        {saving ? (
          <span className="absolute inset-0 inline-flex items-center justify-center">
            <Spinner size="xs" tone="current" />
          </span>
        ) : null}
        <span className={cn("flex items-center gap-1", saving && "invisible")}>
          <Check className="size-4" aria-hidden="true" />
          Save shape
        </span>
      </button>
      <button type="button" aria-label="Cancel shape edit" title="Cancel — the saved shape is untouched (Esc)" className={cn(BUTTON, GHOST)} onClick={onCancel}>
        <X className="size-4" aria-hidden="true" />
        Cancel
      </button>
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
      <button type="button" aria-label="Undo saved edit" title={undoBlockedReason ?? "Undo the last saved edit (Ctrl+Z)"} className={cn(BUTTON, GHOST)} disabled={!canUndo || busy} onClick={onUndo}>
        <Undo2 className="size-4" aria-hidden="true" />
        Undo
      </button>
      <button type="button" aria-label="Redo saved edit" title="Redo (Ctrl+Shift+Z)" className={cn(BUTTON, GHOST)} disabled={!canRedo || busy} onClick={onRedo}>
        <Redo2 className="size-4" aria-hidden="true" />
        Redo
      </button>
    </div>
  );
}
PersistedHistoryControls.displayName = "PersistedHistoryControls";

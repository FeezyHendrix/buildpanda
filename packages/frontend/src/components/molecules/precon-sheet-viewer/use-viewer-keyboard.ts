import type { PreconTool } from "@/lib/precon-meta";
import { useToolShortcuts } from "./use-tool-shortcuts";
import type { useBatchWiring } from "./use-batch-wiring";
import type { useDiscardGuard } from "./discard-guard";
import type { useDraft, useDragRect } from "./use-draft";
import type { useOpHistory } from "./use-op-history";
import type { useSavedEdit } from "./use-saved-edit";
import type { useScalePrompt } from "./use-scale-prompt";
import type { useViewerTools } from "./use-viewer-tools";

interface Deps {
  tool: PreconTool;
  onToolChange: (tool: PreconTool) => void;
  changeTool: (tool: PreconTool) => void;
  toolBlockedReason: (tool: PreconTool) => string | null;
  selectedRowId: string | null;
  onSelectRow: (rowId: string | null) => void;
  guard: ReturnType<typeof useDiscardGuard>;
  scale: ReturnType<typeof useScalePrompt>;
  tools: ReturnType<typeof useViewerTools>;
  draftApi: ReturnType<typeof useDraft>;
  dragRect: ReturnType<typeof useDragRect>;
  savedEdit: ReturnType<typeof useSavedEdit>;
  opHistory: ReturnType<typeof useOpHistory>;
  batch: ReturnType<typeof useBatchWiring>;
  dirtyDraft: boolean;
  /** Suspended while a modal owns the keyboard (the composer, the discard prompt). */
  enabled: boolean;
  finishDraft: () => void;
  clearNote: () => void;
  releaseMagnifier: () => void;
  onToggleLegend: () => void;
}

/**
 * The keyboard accelerators, and the one Escape ladder they share with the
 * visible Cancel buttons.
 *
 * Every shortcut here duplicates a control that is on screen: the keyboard is
 * an accelerator, never the only way to reach an action. `cancel` is returned
 * because the visible Cancel must back out through the same ladder Escape does
 * — two ladders would drift.
 */
export function useViewerKeyboard(deps: Deps) {
  const { guard, scale, tools, draftApi, dragRect, savedEdit, opHistory, batch } = deps;

  // Esc backs out one layer at a time: prompt → half-drawn shape → selection →
  // tool. It never touches a saved measurement.
  const cancel = () => {
    if (guard.pending) return guard.dismiss();
    if (scale.prompt || tools.viewportDraft || tools.detectionActive) {
      scale.clear();
      tools.reset();
      draftApi.clear();
      return;
    }
    if (savedEdit.edit) return savedEdit.cancel();
    if (deps.dirtyDraft || dragRect.rect) {
      draftApi.clear();
      dragRect.cancel();
      return;
    }
    deps.clearNote();
    deps.releaseMagnifier();
    if (deps.selectedRowId) return deps.onSelectRow(null);
    if (deps.tool !== "select") deps.onToolChange("select");
  };

  useToolShortcuts(
    {
      onEscape: cancel,
      onEnter: () => {
        if (tools.detect.review) tools.detect.confirmCount();
        else if (!scale.prompt && !tools.viewportDraft && !tools.detectionActive) deps.finishDraft();
      },
      onBackspace: () => (savedEdit.edit && savedEdit.edit.selectedVertex !== null ? savedEdit.removeSelected() : draftApi.undo()),
      onUndo: () => (draftApi.canUndo ? draftApi.undo() : savedEdit.edit ? undefined : opHistory.undo()),
      onRedo: () => (draftApi.canRedo ? draftApi.redo() : savedEdit.edit ? undefined : opHistory.redo()),
      onTool: (next) => {
        // Z is a hold (useMagnifierHold); the palette button makes it sticky
        if (next === "magnifier") return;
        if (!deps.toolBlockedReason(next)) deps.changeTool(next);
      },
      onToggleLegend: deps.onToggleLegend,
      onCopy: batch.copy,
      onPaste: batch.paste,
      onDuplicate: batch.duplicateSelection,
    },
    deps.enabled,
  );

  return cancel;
}

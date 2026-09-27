import { useEffect, useRef } from "react";
import { isTypingTarget, toolForShortcut, type PreconTool } from "@/lib/precon-meta";

interface Handlers {
  onEscape: () => void;
  onEnter: () => void;
  /** Backspace/Delete: remove the last logical placement of the draft. */
  onBackspace: () => void;
  /** Ctrl/Cmd+Z. */
  onUndo: () => void;
  /** Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y. */
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onTool: (tool: PreconTool) => void;
  onToggleLegend: () => void;
}

/**
 * Single-letter tool keys, Enter to finish, Esc to cancel, Backspace to remove
 * the last point and Ctrl/Cmd+Z / Shift+Z / Y for draft undo/redo — none of
 * which fire while the user is typing in a field, so text inputs keep their
 * native editing and undo. Handlers are read through a ref so the listener is
 * attached once, not on every draft change.
 */
export function useToolShortcuts(handlers: Handlers, enabled = true) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === "Escape") return ref.current.onEscape();
      if (e.key === "Enter") return ref.current.onEnter();
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault(); // Backspace must never navigate the browser back
        return ref.current.onBackspace();
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        return e.shiftKey ? ref.current.onRedo() : ref.current.onUndo();
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        return ref.current.onRedo();
      }
      if (mod && (e.key === "c" || e.key === "C")) return ref.current.onCopy();
      if (mod && (e.key === "v" || e.key === "V")) return ref.current.onPaste();
      if (mod && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        return ref.current.onDuplicate();
      }
      const tool = toolForShortcut(e.key, { ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey });
      if (!tool) return;
      e.preventDefault();
      if (tool === "legend") ref.current.onToggleLegend();
      else ref.current.onTool(tool);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

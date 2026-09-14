import { useEffect, useRef } from "react";
import { isTypingTarget, toolForShortcut, type PreconTool } from "@/lib/precon-meta";

interface Handlers {
  onEscape: () => void;
  onEnter: () => void;
  onTool: (tool: PreconTool) => void;
  onToggleLegend: () => void;
}

/**
 * Single-letter tool keys, Enter to finish and Esc to cancel, none of which
 * fire while the user is typing in a field. Handlers are read through a ref so
 * the listener is attached once, not on every draft change.
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
      if (e.key === "Escape") {
        ref.current.onEscape();
        return;
      }
      if (e.key === "Enter") {
        ref.current.onEnter();
        return;
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

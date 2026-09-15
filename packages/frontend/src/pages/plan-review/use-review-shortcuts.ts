import { useEffect } from "react";
import { KEY, TOOLS } from "./plan-review-types";
import type { MarkupToolsController } from "./use-markup-tools";
import type { SheetNavigationController } from "./use-sheet-navigation";

/** Only shortcuts for visible tools; typing in a field never changes the drawing. */
export function useReviewShortcuts({
  nav,
  markup,
  onDismiss,
}: {
  nav: SheetNavigationController;
  markup: MarkupToolsController;
  onDismiss: () => void;
}): void {
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.defaultPrevented) return;
      if (event.key === KEY.ESCAPE) {
        markup.resetTransient();
        onDismiss();
        return;
      }
      const target = event.target as HTMLElement;
      if (
        nav.comparing ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        target.isContentEditable ||
        target.closest("[data-popover-root], [data-comment-popover]") ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
        return;
      if ((event.key === KEY.DELETE || event.key === KEY.BACKSPACE) && markup.selection) {
        event.preventDefault();
        markup.deleteSelection();
        return;
      }
      const tool = TOOLS.find((item) => item.shortcut.toLowerCase() === event.key.toLowerCase());
      if (tool) {
        event.preventDefault();
        markup.selectTool(tool.id);
      }
      if (event.key === KEY.ARROW_LEFT) {
        event.preventDefault();
        nav.goTo(nav.activeSheetIndex - 1);
      }
      if (event.key === KEY.ARROW_RIGHT) {
        event.preventDefault();
        nav.goTo(nav.activeSheetIndex + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}

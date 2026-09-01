import { useEffect } from "react";
import { KEY, POPOVER, TOOLS, type PopoverId } from "./plan-review-types";
import type { MarkupToolsController } from "./use-markup-tools";
import type { SheetNavigationController } from "./use-sheet-navigation";

interface ReviewShortcutsArgs {
  nav: SheetNavigationController;
  markup: MarkupToolsController;
  openPopover: PopoverId | null;
  setOpenPopover: React.Dispatch<React.SetStateAction<PopoverId | null>>;
}

/**
 * Global input for the review workspace: dismissing popovers by clicking away,
 * and the keyboard map a reviewer works the sheet with (Escape, delete, search,
 * the single-letter tool shortcuts and arrow-key sheet paging).
 */
export function useReviewShortcuts({ nav, markup, openPopover, setOpenPopover }: ReviewShortcutsArgs): void {
  useEffect(() => {
    if (!openPopover) return;
    function onDown(e: MouseEvent): void {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-popover-root]") && !target.closest("[data-popover-trigger]")) {
        setOpenPopover(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openPopover, setOpenPopover]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === KEY.ESCAPE) {
        setOpenPopover(null);
        markup.setMeasureStart(null);
        markup.setSelection(null);
        return;
      }
      const target = e.target as HTMLElement;
      // A rich-text editor is a contenteditable div, not an input, so it must be
      // excluded explicitly or typing "/" or a tool letter fires a shortcut and
      // swallows the character.
      if (
        e.isComposing ||
        target.isContentEditable ||
        target.closest("[data-popover-root]") ||
        target.closest("[data-comment-popover]") ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if ((e.key === KEY.DELETE || e.key === KEY.BACKSPACE) && markup.selection) {
        e.preventDefault();
        markup.deleteSelection();
        return;
      }
      if (e.key === KEY.SLASH) {
        e.preventDefault();
        setOpenPopover(POPOVER.SEARCH);
        return;
      }
      const tool = TOOLS.find((t) => t.shortcut.toLowerCase() === e.key.toLowerCase());
      if (tool) {
        markup.selectTool(tool.id);
        return;
      }
      if (!nav.split.open && e.key === KEY.ARROW_LEFT) nav.goTo(nav.activeSheetIndex - 1);
      if (!nav.split.open && e.key === KEY.ARROW_RIGHT) nav.goTo(nav.activeSheetIndex + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}

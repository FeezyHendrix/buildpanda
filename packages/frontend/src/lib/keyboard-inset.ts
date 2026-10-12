/**
 * The web's KeyboardAvoidingView. Mobile browsers (iOS Safari always, Android
 * without `interactive-widget=resizes-content`) slide the on-screen keyboard
 * over the page without shrinking it, so a full-height drawer keeps its footer
 * and the field being typed in hidden underneath. This publishes the visible
 * area as CSS variables that the `*-visible` utilities in index.css size the
 * drawers, sheets and dialogs to, then brings the focused field back into view.
 *
 *   --vv-top          how far the browser panned the page up (iOS)
 *   --vv-height       the height left above the keyboard
 *   --keyboard-inset  the keyboard's height
 *
 * Each is unset while no keyboard is open, so the utilities fall back to the
 * full viewport and desktop is unaffected.
 */

/** Anything shorter is browser chrome (URL bar) collapsing, not a keyboard. */
const MIN_KEYBOARD_PX = 120;

function isEditable(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return !["button", "checkbox", "radio", "range", "submit", "reset", "file", "color", "image"].includes(el.type);
}

/** Scroll the field into the middle of what's left of the screen; a tall editor keeps its bottom (the caret) in view. */
function reveal(el: HTMLElement): void {
  const tall = el.getBoundingClientRect().height > (window.visualViewport?.height ?? window.innerHeight) / 2;
  el.scrollIntoView({ block: tall ? "nearest" : "center", behavior: "smooth" });
}

let installed = false;

export function installKeyboardInset(): void {
  const vv = window.visualViewport;
  if (installed || !vv) return;
  installed = true;
  const root = document.documentElement.style;
  let open = false;
  let revealTimer: number | undefined;

  function update(): void {
    if (!vv) return;
    const inset = window.innerHeight - vv.height - vv.offsetTop;
    // Pinch-zoom also shrinks the visual viewport; only a keyboard counts.
    const keyboard = vv.scale <= 1.01 && inset >= MIN_KEYBOARD_PX;
    if (keyboard) {
      root.setProperty("--vv-top", `${Math.round(vv.offsetTop)}px`);
      root.setProperty("--vv-height", `${Math.round(vv.height)}px`);
      root.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
    } else if (open) {
      root.removeProperty("--vv-top");
      root.removeProperty("--vv-height");
      root.removeProperty("--keyboard-inset");
    }
    // The keyboard just opened: once the drawer has shrunk, re-centre the field.
    if (keyboard && !open) scheduleReveal();
    open = keyboard;
  }

  function scheduleReveal(): void {
    window.clearTimeout(revealTimer);
    revealTimer = window.setTimeout(() => {
      const active = document.activeElement;
      if (isEditable(active)) reveal(active);
    }, 50);
  }

  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  // Moving between fields with the keyboard already up fires no resize.
  document.addEventListener("focusin", (event) => {
    if (open && isEditable(event.target as Element)) scheduleReveal();
  });
  update();
}

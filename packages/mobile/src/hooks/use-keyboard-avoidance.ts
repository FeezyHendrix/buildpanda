import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Keyboard, Platform, TextInput, type ScrollView, type View } from "react-native";

/** Room left between the focused field and the keyboard or footer. */
const MARGIN = 24;

/**
 * Lets a field ask the page it sits in to bring it into view. `Field` calls it
 * on focus, which covers moving between fields while the keyboard stays up —
 * no keyboard event fires for that.
 */
export const KeyboardRevealContext = createContext<(() => void) | null>(null);

export function useKeyboardReveal(): (() => void) | null {
  return useContext(KeyboardRevealContext);
}

/**
 * What `Page` needs to keep the field being typed in visible:
 *
 * - `keyboardShown`, so the footer drops its home-indicator padding while the
 *   keyboard covers that strip anyway.
 * - `offset` for KeyboardAvoidingView, which compares its own frame (relative to
 *   its parent) with the keyboard's position on screen. On a screen presented as
 *   a sheet (capture) the page does not start at the top of the screen, so
 *   without this the padding comes up short by the sheet's offset.
 * - `reveal`, which scrolls the focused input clear of the keyboard and footer.
 */
export function useKeyboardAvoidance() {
  const rootRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [keyboardShown, setKeyboardShown] = useState(false);
  const [offset, setOffset] = useState(0);

  const measureOffset = useCallback(() => {
    rootRef.current?.measureInWindow((_x, y) => {
      if (Number.isFinite(y)) setOffset((current) => (Math.abs(current - y) > 1 ? y : current));
    });
  }, []);

  const reveal = useCallback(() => {
    clearTimeout(timer.current);
    // wait for KeyboardAvoidingView to shrink the scroll area first
    timer.current = setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const scroll = scrollRef.current;
      if (!input || !scroll) return;
      scroll.getNativeScrollRef()?.measureInWindow((_sx, sy, _sw, sh) => {
        input.measureInWindow((_ix, iy, _iw, ih) => {
          // a field taller than the view only needs its top in view
          const below = iy + Math.min(ih, sh - MARGIN * 2) - (sy + sh - MARGIN);
          const above = sy + MARGIN - iy;
          const delta = below > 0 ? below : above > 0 ? -above : 0;
          if (delta !== 0) scroll.scrollTo({ y: Math.max(0, scrollY.current + delta), animated: true });
        });
      });
    }, Platform.OS === "ios" ? 60 : 150);
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const subs = [
      Keyboard.addListener(showEvent, () => {
        setKeyboardShown(true);
        measureOffset();
      }),
      Keyboard.addListener("keyboardDidShow", reveal),
      Keyboard.addListener(hideEvent, () => setKeyboardShown(false)),
    ];
    return () => {
      clearTimeout(timer.current);
      subs.forEach((sub) => sub.remove());
    };
  }, [measureOffset, reveal]);

  return {
    rootRef,
    scrollRef,
    keyboardShown,
    offset,
    measureOffset,
    reveal,
    onScroll: (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      scrollY.current = event.nativeEvent.contentOffset.y;
    },
  };
}

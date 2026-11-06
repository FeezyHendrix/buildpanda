import { useCallback, useEffect, useRef, type PointerEvent, type MouseEvent } from "react";

const MOVE_TOLERANCE_PX = 10;

/**
 * Touch-only press-and-hold. Fires after `delay` ms of a still finger; moving
 * (a scroll), lifting or leaving cancels it. Mouse input is ignored, so desktop
 * keeps its hover controls.
 */
export function useLongPress(onLongPress: () => void, delay = 450) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        navigator.vibrate?.(10);
        onLongPress();
      }, delay);
    },
    onPointerMove: (e: PointerEvent) => {
      const start = origin.current;
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE_PX) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    // A long press also raises the browser's own menu on phones; ours replaces it.
    onContextMenu: (e: MouseEvent) => {
      if (window.matchMedia("(pointer: coarse)").matches) e.preventDefault();
    },
  };
}

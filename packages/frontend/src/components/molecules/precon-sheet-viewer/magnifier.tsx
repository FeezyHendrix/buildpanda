import { useEffect, useState, type RefObject } from "react";
import { isTypingTarget } from "@/lib/precon-meta";

export const LENS_PX = 160;
const MAGNIFICATION = 3;

/** True while Z is held down outside a text field (no modifiers). */
export function useMagnifierHold(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const isZ = (e: KeyboardEvent) => e.key.toLowerCase() === "z" && !e.ctrlKey && !e.metaKey && !e.altKey;
    const onDown = (e: KeyboardEvent) => {
      if (isZ(e) && !isTypingTarget(e.target)) setHeld(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (isZ(e)) setHeld(false);
    };
    const onBlur = () => setHeld(false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
  return held;
}

interface Props {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  screenToCanvas: (clientX: number, clientY: number) => [number, number] | null;
  cssZoom: number;
}

/**
 * A 160 px lens at the cursor showing the rasterised sheet at 3× the current
 * screen magnification, copied straight from the sheet canvas. Shown while Z
 * is held or the palette's Magnifier is on.
 */
export function Magnifier({ containerRef, canvasRef, screenToCanvas, cssZoom }: Props) {
  const [pointer, setPointer] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const [lens, setLens] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top, clientX: e.clientX, clientY: e.clientY });
    };
    const onLeave = () => setPointer(null);
    container.addEventListener("mousemove", onMove, { passive: true });
    container.addEventListener("mouseleave", onLeave, { passive: true });
    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
    };
  }, [containerRef]);

  useEffect(() => {
    const source = canvasRef.current;
    const ctx = lens?.getContext("2d");
    if (!lens || !ctx || !source || !pointer) return;
    const at = screenToCanvas(pointer.clientX, pointer.clientY);
    if (!at) return;
    const half = LENS_PX / (2 * MAGNIFICATION * cssZoom);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, LENS_PX, LENS_PX);
    ctx.drawImage(source, at[0] - half, at[1] - half, half * 2, half * 2, 0, 0, LENS_PX, LENS_PX);
  }, [lens, canvasRef, pointer, screenToCanvas, cssZoom]);

  if (!pointer) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-20 overflow-hidden rounded-full border-2 border-primary-500 bg-white shadow-lg"
      style={{ width: LENS_PX, height: LENS_PX, left: pointer.x - LENS_PX / 2, top: pointer.y - LENS_PX / 2 }}
    >
      <canvas ref={setLens} width={LENS_PX} height={LENS_PX} className="block" />
      <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-500" />
    </div>
  );
}
Magnifier.displayName = "Magnifier";

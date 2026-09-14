import { useEffect, useRef, useState } from "react";
import type { PreconSheet } from "@/api/precon";
import { loadSheetBitmap } from "./use-sheet-loader";

const TINT = "#DC2626";
const OPACITY = 0.4;

interface Props {
  sheet: PreconSheet;
  sheets: PreconSheet[];
  /** The current sheet's canvas size; the previous revision is stretched to it (frame / page size alignment). */
  widthPx: number;
  heightPx: number;
  onError?: (message: string) => void;
}

/**
 * The previous revision's sheet under the current one at 40 % opacity, its
 * linework tinted red. Multiply blending drops the paper so only the lines
 * show: what has moved reads as a red ghost beside the current black line.
 */
export function OverlayLayer({ sheet, sheets, widthPx, heightPx, onError }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      const bitmap = await loadSheetBitmap(sheet, sheets, widthPx);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (cancelled || !canvas || !ctx) return;
      canvas.width = widthPx;
      canvas.height = heightPx;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, widthPx, heightPx);
      ctx.drawImage(bitmap, 0, 0, widthPx, heightPx);
      // dark linework takes the tint, white paper stays white (and then vanishes under multiply)
      ctx.globalCompositeOperation = "lighten";
      ctx.fillStyle = TINT;
      ctx.fillRect(0, 0, widthPx, heightPx);
      ctx.globalCompositeOperation = "source-over";
      setReady(true);
    })().catch((error: unknown) => {
      if (!cancelled) onError?.(`Could not load the previous revision: ${error instanceof Error ? error.message : String(error)}`);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.id, widthPx, heightPx]);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0" style={{ mixBlendMode: "multiply", opacity: ready ? OPACITY : 0, width: widthPx, height: heightPx }} />;
}
OverlayLayer.displayName = "OverlayLayer";

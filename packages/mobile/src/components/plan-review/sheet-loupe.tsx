import { useEffect, useRef } from "react";

// A finger covers the point it is placing. Every field app that gets precise
// placement right shows the sheet under the fingertip somewhere the finger is
// not, so the loupe follows the touch and sits above and to the side of it,
// with a crosshair on the exact point that will be committed.

const SIZE = 116;
const MAGNIFY = 2.5;
const OFFSET_Y = 96;
const EDGE_PAD = 8;

export interface LoupeSource {
  /** The rendered sheet: a canvas for a PDF, an image for a picture. */
  el: HTMLCanvasElement | HTMLImageElement | null;
  /** The sheet's laid-out size in CSS pixels, before the viewport transform. */
  boxW: number;
  boxH: number;
}

export interface LoupeProps {
  source: LoupeSource;
  /** Where the finger is, in viewport pixels. */
  at: { x: number; y: number } | null;
  /** The viewport transform the sheet is drawn under. */
  transform: { tx: number; ty: number; s: number };
  viewportW: number;
}

function naturalSize(el: HTMLCanvasElement | HTMLImageElement): { w: number; h: number } {
  return el instanceof HTMLCanvasElement ? { w: el.width, h: el.height } : { w: el.naturalWidth, h: el.naturalHeight };
}

/** The sheet under the fingertip, magnified, while a point is being placed. */
export function SheetLoupe({ source, at, transform, viewportW }: LoupeProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const out = ref.current;
    const el = source.el;
    if (!out || !el || !at || source.boxW <= 0) return;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    // viewport pixels → the sheet's own pixels
    const inBoxX = (at.x - transform.tx) / transform.s;
    const inBoxY = (at.y - transform.ty) / transform.s;
    const natural = naturalSize(el);
    if (!natural.w || !natural.h) return;
    const toSource = natural.w / source.boxW;
    const cx = inBoxX * toSource;
    const cy = inBoxY * (natural.h / source.boxH);
    // how much of the sheet fills the loupe at this magnification
    const half = (SIZE / 2 / MAGNIFY) * (toSource / transform.s);

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, SIZE, SIZE);
    try {
      ctx.drawImage(el, cx - half, cy - half, half * 2, half * 2, 0, 0, SIZE, SIZE);
    } catch {
      // a source that is not yet decodable draws nothing; the crosshair still helps
    }
    ctx.strokeStyle = "#004DE7";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(SIZE / 2, SIZE / 2 - 10);
    ctx.lineTo(SIZE / 2, SIZE / 2 + 10);
    ctx.moveTo(SIZE / 2 - 10, SIZE / 2);
    ctx.lineTo(SIZE / 2 + 10, SIZE / 2);
    ctx.stroke();
  }, [source.el, source.boxW, source.boxH, at, transform.tx, transform.ty, transform.s]);

  if (!at || !source.el) return null;
  // sit above the finger, and flip to the other side rather than leave the screen
  const left = Math.min(Math.max(EDGE_PAD, at.x - SIZE / 2), viewportW - SIZE - EDGE_PAD);
  const top = at.y - OFFSET_Y - SIZE / 2;
  const flipped = top < EDGE_PAD;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top: flipped ? at.y + OFFSET_Y - SIZE / 2 : top,
        width: SIZE,
        height: SIZE,
        borderRadius: "50%",
        overflow: "hidden",
        border: "2px solid #FFFFFF",
        boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <canvas ref={ref} width={SIZE} height={SIZE} style={{ width: SIZE, height: SIZE, display: "block" }} />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { loadPdfjs, pageText } from "@/lib/pdfjs";
import { Spinner } from "@/components/atoms/spinner";
import { cn } from "@/lib/utils";
import { parseSheetScale, type DetectedScale } from "./plan-review-data";

type PdfDocumentProxy = import("pdfjs-dist").PDFDocumentProxy;

const BASE_SCALE = 1.6;

export interface PdfRenderState {
  pageCount: number;
  pageNumber: number;
  aspect: number;
  detectedScale: DetectedScale | null;
}

/** pdf.js signals a cancelled render with this name rather than a typed error. */
function isRenderCancelled(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: string }).name === "RenderingCancelledException";
}

/**
 * Renders a PDF page to a canvas with pdfjs, the same path the takeoff engine
 * uses. Canvas rendering (rather than an iframe) keeps the sheet inside the
 * markup coordinate space and avoids the API's frame-ancestors CSP.
 */
export function PdfSheetCanvas({
  url,
  title,
  className,
  pageNumber,
  onRenderStateChange,
}: {
  url: string;
  title: string;
  className?: string;
  pageNumber: number;
  onRenderStateChange?: (state: PdfRenderState) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<{ url: string; doc: PdfDocumentProxy } | null>(null);
  // pdf.js refuses to render two pages onto one canvas at the same time, and a
  // plain "cancelled" flag does not stop the render already running. Flipping
  // pages quickly therefore threw "Cannot use the same canvas during multiple
  // render() operations" and left the sheet blank until reload. The task is
  // held so it can actually be cancelled and waited on.
  const renderTaskRef = useRef<{ cancel: () => void; promise: Promise<unknown> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const pdfjs = await loadPdfjs();

      const cached = docRef.current;
      const doc =
        cached && cached.url === url
          ? cached.doc
          : await pdfjs.getDocument({ url, withCredentials: true }).promise;
      if (cancelled) return;
      docRef.current = { url, doc };

      const safePage = Math.min(Math.max(1, pageNumber), doc.numPages);
      const page = await doc.getPage(safePage);
      if (cancelled) return;

      const viewport = page.getViewport({ scale: BASE_SCALE });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const previous = renderTaskRef.current;
      if (previous) {
        previous.cancel();
        await previous.promise.catch(() => {});
      }
      if (cancelled) return;

      const task = page.render({ canvasContext: ctx, viewport, canvas });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
      if (cancelled) return;

      const sheetText = await pageText(page);
      if (cancelled) return;
      const unscaledWidthPt = viewport.width / BASE_SCALE;

      setLoading(false);
      onRenderStateChange?.({
        pageCount: doc.numPages,
        pageNumber: safePage,
        aspect: viewport.height / viewport.width,
        detectedScale: parseSheetScale(sheetText, unscaledWidthPt),
      });
    })().catch((err: unknown) => {
      // Cancelling the previous page is the normal path when someone pages
      // through a drawing, not a failure to show them.
      if (cancelled || isRenderCancelled(err)) return;
      setLoading(false);
      setError(err instanceof Error ? err.message : "Could not render this PDF");
    });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, pageNumber]);

  return (
    <div className={cn("relative", className)}>
      <canvas ref={canvasRef} className="block w-full rounded-lg" aria-label={title} />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <Spinner size="md" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/90 px-6 text-center">
          <p className="text-sm font-medium text-gray-900">Could not render this PDF</p>
          <p className="text-xs text-gray-500">{error}</p>
        </div>
      )}

    </div>
  );
}

PdfSheetCanvas.displayName = "PdfSheetCanvas";

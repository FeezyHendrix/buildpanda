import { useEffect, useRef, useState } from "react";
// ?worker makes Vite emit the worker as a .js chunk and hand back a Worker
// constructor — static hosts that serve .mjs as octet-stream (staging nginx)
// break both workerSrc and the fake-worker fallback, so never fetch .mjs.
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";
import { Spinner } from "@/components/atoms/spinner";
import { cn } from "@/lib/utils";
import { parseSheetScale, type DetectedScale } from "./plan-review-data";

let sharedWorker: Worker | null = null;

type PdfDocumentProxy = import("pdfjs-dist").PDFDocumentProxy;

const BASE_SCALE = 1.6;

export interface PdfRenderState {
  pageCount: number;
  pageNumber: number;
  aspect: number;
  detectedScale: DetectedScale | null;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const pdfjs = await import("pdfjs-dist");
      if (!sharedWorker) sharedWorker = new PdfWorker();
      pdfjs.GlobalWorkerOptions.workerPort = sharedWorker;

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
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      if (cancelled) return;

      const textContent = await page.getTextContent().catch(() => null);
      if (cancelled) return;
      const sheetText = textContent
        ? textContent.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
        : "";
      const unscaledWidthPt = viewport.width / BASE_SCALE;

      setLoading(false);
      onRenderStateChange?.({
        pageCount: doc.numPages,
        pageNumber: safePage,
        aspect: viewport.height / viewport.width,
        detectedScale: parseSheetScale(sheetText, unscaledWidthPt),
      });
    })().catch((err: unknown) => {
      if (cancelled) return;
      setLoading(false);
      setError(err instanceof Error ? err.message : "Could not render this PDF");
    });

    return () => {
      cancelled = true;
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

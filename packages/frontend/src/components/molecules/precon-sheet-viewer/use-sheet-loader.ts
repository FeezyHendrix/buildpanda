import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
// ?worker makes Vite emit the worker as a .js chunk and hand back a Worker
// constructor — static hosts that serve .mjs as octet-stream (staging nginx)
// break both workerSrc and the fake-worker fallback, so never fetch .mjs.
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";
import { PICTURE_PLAN } from "@/lib/precon-meta";
import { preconApi, type PreconSheet } from "@/api/precon";

let sharedWorker: Worker | null = null;

export const BASE_RASTER = 1.5;
const MAX_RASTER = 4.5;
// a DWG is fitted to this many pixels wide at the base raster before zoom
const IMAGE_FIT_WIDTH_PX = 2400;

/** A DWG's SVG viewBox in drawing units; y runs down as in SVG. */
export interface DrawingFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageInfo {
  widthPx: number;
  heightPx: number;
  heightPt: number;
  rasterScale: number;
  /**
   * Present for a DWG: sheet "points" are then drawing units (the stored scale
   * is 1 mm per unit), mapped through this frame instead of the raster scale.
   */
  frame?: DrawingFrame;
  /**
   * Present for a PDF: pdf.js's viewport transform at the raster scale, which
   * places PDF user-space points on the canvas. A CAD export often centres its
   * page on the origin, so points can be negative; the transform knows.
   */
  matrix?: [number, number, number, number, number, number];
}

export function parseViewBox(svg: string): DrawingFrame | null {
  const open = svg.match(/<svg\b[^>]*>/);
  const box = open?.[0].match(/viewBox="([^"]+)"/)?.[1]?.trim().split(/[\s,]+/).map(Number);
  if (!box || box.length !== 4 || !box.every(Number.isFinite) || box[2]! <= 0 || box[3]! <= 0) return null;
  return { x: box[0]!, y: box[1]!, w: box[2]!, h: box[3]! };
}

type PdfPageProxy = import("pdfjs-dist").PDFPageProxy;

// The engine's SVG carries only a viewBox; give it explicit pixel dimensions
// so every browser reports a natural size and the canvas is never 0×0.
function sizedSvg(svg: string): string {
  const open = svg.match(/<svg\b[^>]*>/);
  if (!open || /\swidth=/.test(open[0])) return svg;
  const box = open[0].match(/viewBox="([^"]+)"/)?.[1]?.trim().split(/[\s,]+/).map(Number);
  if (!box || box.length !== 4 || !box.every(Number.isFinite) || box[2]! <= 0 || box[3]! <= 0) return svg;
  const width = IMAGE_FIT_WIDTH_PX;
  const height = Math.max(1, Math.round((width * box[3]!) / box[2]!));
  return svg.replace(open[0], open[0].replace(/<svg\b/, `<svg width="${width}" height="${height}"`));
}

/** Page number within the sheet's own PDF file (sheets are contiguous per file). */
function pageWithinFile(sheet: PreconSheet, sheets: PreconSheet[]): number {
  const siblings = [...sheets.filter((s) => s.fileName === sheet.fileName)].sort((a, b) => a.pageNumber - b.pageNumber);
  return siblings.findIndex((s) => s.id === sheet.id) + 1;
}

function loadImage(svg: string): Promise<HTMLImageElement> {
  return loadImageFromUrl(URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })), true);
}

function loadImageFromUrl(url: string, revoke = false): Promise<HTMLImageElement> {
  const img = new Image();
  return new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The drawing could not be decoded"));
    img.src = url;
  }).finally(() => {
    if (revoke) URL.revokeObjectURL(url);
  });
}

// A picture sheet is fetched with credentials and drawn like a DWG raster,
// but its points are plain image pixels over the raster scale, as for a PDF.
async function loadPicture(sheetId: string): Promise<HTMLImageElement> {
  const res = await fetch(preconApi.sheetFileUrl(sheetId), { credentials: "include" });
  if (!res.ok) throw new Error(`Picture ${res.status}`);
  return loadImageFromUrl(URL.createObjectURL(await res.blob()), true);
}

/** pdf.js with the shared worker attached; imported on demand so the chunk stays out of the initial route. */
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!sharedWorker) sharedWorker = new PdfWorker();
  pdfjs.GlobalWorkerOptions.workerPort = sharedWorker;
  return pdfjs;
}

async function loadDwgSvg(sheetId: string): Promise<{ img: HTMLImageElement; frame: DrawingFrame | null }> {
  const res = await fetch(preconApi.sheetSvgUrl(sheetId), { credentials: "include" });
  if (!res.ok) throw new Error(res.status === 404 ? "Nothing drawable in this DWG's model space" : `SVG ${res.status}`);
  const raw = await res.text();
  return { img: await loadImage(sizedSvg(raw)), frame: parseViewBox(raw) };
}

/**
 * Any sheet as something drawImage accepts, sized to `widthPx` wide — for the
 * revision overlay, which stretches it onto the current sheet's canvas.
 */
export async function loadSheetBitmap(sheet: PreconSheet, sheets: PreconSheet[], widthPx: number): Promise<CanvasImageSource> {
  if (/\.dwg$/i.test(sheet.fileName)) return (await loadDwgSvg(sheet.id)).img;
  if (PICTURE_PLAN.test(sheet.fileName)) return loadPicture(sheet.id);
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ url: preconApi.sheetFileUrl(sheet.id), withCredentials: true }).promise;
  const pdfPage = await doc.getPage(pageWithinFile(sheet, sheets));
  const scale = widthPx / pdfPage.getViewport({ scale: 1 }).width;
  const viewport = pdfPage.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas;
}

interface Args {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  activeSheet: PreconSheet | null;
  sheets: PreconSheet[];
  userZoom: number;
  /** Called once a sheet is first drawn, so the view can be fitted. */
  onLoaded: () => void;
}

/**
 * Loads the active sheet onto the canvas — a PDF page through pdfjs, a DWG as
 * the engine's SVG drawn as an image — and re-rasters it when zoom crosses a
 * DPI threshold. Both paths publish the same PageInfo, so pan, zoom and the
 * overlay maths are identical: "points" are PDF points, or image pixels at the
 * base raster for a DWG.
 */
export function useSheetLoader({ canvasRef, activeSheet, sheets, userZoom, onLoaded }: Args) {
  const [page, setPage] = useState<PageInfo | null>(null);
  const [rendering, setRendering] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  // Rasterize a cached pdfjs page and publish the matching page-state in the
  // same pass, so toPx/toPt/cssZoom always agree with the pixels on the canvas.
  const rasterize = useCallback(
    async (pdfPage: PdfPageProxy, scale: number, isCancelled: () => boolean) => {
      const viewport = pdfPage.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas || isCancelled()) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
      if (isCancelled()) return;
      const t = viewport.transform as number[];
      setPage({
        widthPx: viewport.width,
        heightPx: viewport.height,
        heightPt: viewport.height / scale,
        rasterScale: scale,
        matrix: [t[0]!, t[1]!, t[2]!, t[3]!, t[4]!, t[5]!],
      });
    },
    [canvasRef],
  );

  const rasterizeImage = useCallback(
    (img: HTMLImageElement, scale: number, frame: DrawingFrame | null) => {
      const canvas = canvasRef.current;
      if (!canvas || !Number.isFinite(scale) || scale <= 0) return;
      const fit = IMAGE_FIT_WIDTH_PX / Math.max(1, img.naturalWidth);
      const widthPx = Math.round(img.naturalWidth * fit * (scale / BASE_RASTER));
      const heightPx = Math.round(img.naturalHeight * fit * (scale / BASE_RASTER));
      canvas.width = widthPx;
      canvas.height = heightPx;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, widthPx, heightPx);
      ctx.drawImage(img, 0, 0, widthPx, heightPx);
      setPage({ widthPx, heightPx, heightPt: heightPx / scale, rasterScale: scale, frame: frame ?? undefined });
    },
    [canvasRef],
  );

  const [activeRasterScale, setActiveRasterScale] = useState(BASE_RASTER);
  const targetRasterScale = Math.min(MAX_RASTER, BASE_RASTER * Math.max(1, Math.ceil(Number.isFinite(userZoom) ? userZoom : 1)));
  useEffect(() => {
    if (targetRasterScale === activeRasterScale) return;
    const timer = setTimeout(() => setActiveRasterScale(targetRasterScale), 200);
    return () => clearTimeout(timer);
  }, [targetRasterScale, activeRasterScale]);

  // The loaded page is cached per sheet so zoom re-rasters redraw from memory
  // instead of re-downloading the whole file.
  const pdfPageRef = useRef<{ sheetId: string; page: PdfPageProxy } | null>(null);
  const imageRef = useRef<{ sheetId: string; img: HTMLImageElement; frame: DrawingFrame | null } | null>(null);

  useEffect(() => {
    if (!activeSheet) return;
    let cancelled = false;
    const sheetId = activeSheet.id;
    const isDwg = /\.dwg$/i.test(activeSheet.fileName);
    const isPicture = PICTURE_PLAN.test(activeSheet.fileName);
    setLoadError(null);
    setActiveRasterScale(BASE_RASTER);
    setRendering(true);
    pdfPageRef.current = null;
    imageRef.current = null;
    (async () => {
      if (isDwg) {
        const { img, frame } = await loadDwgSvg(sheetId);
        if (cancelled) return;
        imageRef.current = { sheetId, img, frame };
        rasterizeImage(img, BASE_RASTER, frame);
      } else if (isPicture) {
        const img = await loadPicture(sheetId);
        if (cancelled) return;
        imageRef.current = { sheetId, img, frame: null };
        rasterizeImage(img, BASE_RASTER, null);
      } else {
        const pdfjs = await loadPdfjs();
        const doc = await pdfjs.getDocument({ url: preconApi.sheetFileUrl(sheetId), withCredentials: true }).promise;
        if (cancelled) return;
        const pdfPage = await doc.getPage(pageWithinFile(activeSheet, sheets));
        if (cancelled) return;
        pdfPageRef.current = { sheetId, page: pdfPage };
        await rasterize(pdfPage, BASE_RASTER, () => cancelled);
      }
      if (cancelled) return;
      onLoadedRef.current();
      setRendering(false);
    })().catch((error: unknown) => {
      if (cancelled) return;
      setRendering(false);
      const reason = (error instanceof Error ? error.message : String(error)).slice(0, 160);
      setLoadError(`Could not render this ${isDwg ? "drawing" : "sheet"}: ${reason}`);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheet?.id]);

  useEffect(() => {
    if (!activeSheet || !page || page.rasterScale === activeRasterScale) return;
    const image = imageRef.current;
    if (image && image.sheetId === activeSheet.id) {
      rasterizeImage(image.img, activeRasterScale, image.frame);
      return;
    }
    const cached = pdfPageRef.current;
    if (!cached || cached.sheetId !== activeSheet.id) return;
    let cancelled = false;
    void rasterize(cached.page, activeRasterScale, () => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRasterScale, activeSheet?.id]);

  return { page, rendering, loadError };
}

const DEFAULT_DPI = 150;
const MAX_DIMENSION = 2200;

export async function renderPdfPagesToPng(
  buffer: Buffer,
  options: { maxPages?: number; dpi?: number } = {},
): Promise<Buffer[]> {
  const mupdf = await import("mupdf");
  const maxPages = options.maxPages ?? 3;
  const dpi = options.dpi ?? DEFAULT_DPI;

  const doc = mupdf.Document.openDocument(new Uint8Array(buffer), "application/pdf");
  const pageCount = Math.min(doc.countPages(), maxPages);
  const out: Buffer[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const bounds = page.getBounds();
    const widthPt = bounds[2] - bounds[0];
    let scale = dpi / 72;
    if (widthPt * scale > MAX_DIMENSION) {
      scale = MAX_DIMENSION / widthPt;
    }
    const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false);
    out.push(Buffer.from(pixmap.asPNG()));
    pixmap.destroy();
    page.destroy();
  }
  doc.destroy();
  return out;
}

export function pngToDataUrl(png: Buffer): string {
  return `data:image/png;base64,${png.toString("base64")}`;
}

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

// An overview alone makes the notes on a large drawing illegible. Render the
// requested page, followed by overlapping quadrants at their own resolution.
// Rendering clipped pixmaps also avoids allocating an entire A0 page at 300dpi.
export async function renderPdfPageViews(buffer: Buffer, pageNumber: number): Promise<Buffer[]> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(new Uint8Array(buffer), "application/pdf");
  try {
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > doc.countPages()) {
      throw new RangeError("PDF page number is out of range");
    }
    const page = doc.loadPage(pageNumber - 1);
    try {
      const [x0, y0, x1, y1] = page.getBounds();
      const width = x1 - x0;
      const height = y1 - y0;
      const views = [[0, 0, 1, 1], [0, 0, 0.55, 0.55], [0.45, 0, 1, 0.55], [0, 0.45, 0.55, 1], [0.45, 0.45, 1, 1]];
      return views.map(([left, top, right, bottom]) => {
        const scale = Math.min(300 / 72, MAX_DIMENSION / Math.max(width * (right! - left!), height * (bottom! - top!)));
        const bounds: [number, number, number, number] = [
          Math.floor((x0 + width * left!) * scale), Math.floor((y0 + height * top!) * scale),
          Math.ceil((x0 + width * right!) * scale), Math.ceil((y0 + height * bottom!) * scale),
        ];
        const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, bounds, false);
        const device = new mupdf.DrawDevice(mupdf.Matrix.identity, pixmap);
        try {
          pixmap.clear(255);
          page.run(device, mupdf.Matrix.scale(scale, scale));
          device.close();
          return Buffer.from(pixmap.asPNG());
        } finally {
          device.destroy();
          pixmap.destroy();
        }
      });
    } finally {
      page.destroy();
    }
  } finally {
    doc.destroy();
  }
}

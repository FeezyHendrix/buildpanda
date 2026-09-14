// ?worker makes Vite emit the worker as a .js chunk and hand back a Worker
// constructor — static hosts that serve .mjs as octet-stream (staging nginx)
// break both workerSrc and the fake-worker fallback, so never fetch .mjs.
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

// One worker for the whole app. Each viewer used to keep its own module-level
// handle, so opening a drawing in one and a take-off sheet in the other spawned
// a second worker that rendered the same pages twice.
let sharedWorker: Worker | null = null;

/**
 * pdf.js with the shared worker attached. Imported on demand so the chunk
 * stays out of whichever route loads first.
 */
export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!sharedWorker) sharedWorker = new PdfWorker();
  pdfjs.GlobalWorkerOptions.workerPort = sharedWorker;
  return pdfjs;
}

/** Every visible character on a page, for reading a scale note off the sheet. */
export async function pageText(page: import("pdfjs-dist").PDFPageProxy): Promise<string> {
  const content = await page.getTextContent().catch(() => null);
  if (!content) return "";
  return content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
}

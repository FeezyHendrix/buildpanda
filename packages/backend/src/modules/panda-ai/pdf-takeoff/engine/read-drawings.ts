import { readFile } from "node:fs/promises";
import { renderPdfPageViews } from "../../../../lib/document-render.ts";
import { isVisionConfigured } from "../../../../lib/llm-vision.ts";
import type { PreconSheetRow } from "../types.ts";
import { withTempFile } from "./measure-sheet.ts";
import { extractAllPages } from "./measure-file.ts";
import { readDrawingEvidence } from "./drawing-evidence.ts";
import type { DrawingReadDependencies, ReadDrawingFile } from "./drawing-evidence-types.ts";
import type { ProgressFn } from "./run.ts";

// Read the whole set before measuring any plan. A section in the last file is
// just as relevant to the first plan as a section on the next page.
export async function readSessionDrawings(
  sheets: PreconSheetRow[],
  progress: ProgressFn,
  deps: DrawingReadDependencies = { withFile: withTempFile, readEvidence: isVisionConfigured() ? readDrawingEvidence : null },
): Promise<ReadDrawingFile[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const files: ReadDrawingFile[] = [];
  const seen = new Set<string>();
  let globalPage = 1;
  for (const sheet of sheets) {
    if (seen.has(sheet.storage_path)) continue;
    seen.add(sheet.storage_path);
    const result: ReadDrawingFile = { sheet, pages: [], error: null };
    files.push(result);
    try {
      await deps.withFile(sheet.storage_path, "pdf", async (file) => {
        const loading = pdfjs.getDocument({ url: file, useSystemFonts: true });
        const doc = await loading.promise;
        try {
          await progress("reading", `Reading all ${doc.numPages} pages of ${sheet.file_name}`, { pages: doc.numPages });
          const pages = await extractAllPages(doc, pdfjs.OPS);
          const buffer = deps.readEvidence ? await readFile(file) : null;
          for (const page of pages) {
            const label = `${sheet.file_name} p${page.pageNumber}`;
            let evidence = null;
            if (buffer && deps.readEvidence) {
              try {
                evidence = await deps.readEvidence(label, await renderPdfPageViews(buffer, page.pageNumber));
              } catch { /* Keep the native reading and report the missing visual pass below. */ }
              await progress("reading", evidence
                ? `Read ${label}: ${evidence.regions.length} drawing regions for dimensions, schedules and specifications`
                : `Could not read visual details on ${label}; using embedded text, check this sheet in review`);
            }
            result.pages.push({ ...page, label, globalPage: globalPage++, evidence });
          }
        } finally {
          await loading.destroy();
        }
      });
    } catch (error) {
      result.error = error instanceof Error ? error.message : "File processing failed";
    }
  }
  return files;
}

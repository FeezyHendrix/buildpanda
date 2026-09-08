import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { AppError, NotFoundError, ValidationError } from "../../../lib/errors.ts";
import { parseDwgToJson } from "../dwg-takeoff/dwg.ts";
import { withTempDwg } from "../dwg-takeoff/job.ts";
import { sheetPrimitives } from "../dwg-takeoff/sheet-primitives.ts";
import { withTempFile } from "./engine/measure-sheet.ts";
import { extractSheet } from "./engine/pdf-extract.ts";
import { wallPenThreshold } from "./engine/measure.ts";
import { pdfPrimitives } from "./pdf-primitives.ts";
import { roomAt } from "./room-at.ts";
import { symbolMatches } from "./symbol-matches.ts";
import { scaleAt } from "./viewports.ts";
import { PICTURE_PLAN } from "./types.ts";
import type { PreconRepository } from "./repository.ts";
import type { PreconSheetRow, RoomAtBody, RoomAtResult, Segment, SheetGeometry, SymbolMatchesBody, SymbolMatchesResult } from "./types.ts";

// The vector content behind a sheet is read once and kept on disk: parsing a
// DWG or walking a PDF page takes seconds, and every room-fill click or
// symbol search on that sheet needs the same segments, texts and inserts.

const CACHE_DIR = path.join(os.tmpdir(), "precon-geo");

export type GeometryLoader = (sheet: PreconSheetRow, pageInFile: number) => Promise<SheetGeometry>;

const NOT_VECTOR = "Not a vector drawing";

async function readDwg(sheet: PreconSheetRow): Promise<SheetGeometry> {
  const doc = await withTempDwg(sheet.storage_path, (file) => parseDwgToJson(file));
  return { kind: "dwg", ...sheetPrimitives(doc, sheet.bounds ?? null), bounds: sheet.bounds ?? null };
}

async function readPdfPage(sheet: PreconSheetRow, pageInFile: number): Promise<SheetGeometry> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return withTempFile(sheet.storage_path, "pdf", async (file) => {
    const doc = await pdfjs.getDocument({ url: file, useSystemFonts: true }).promise;
    try {
      const page = await doc.getPage(Math.min(Math.max(1, pageInFile), doc.numPages));
      const extracted = await extractSheet(page as never, pdfjs.OPS as never);
      const view = page.view;
      const bounds = view && view.length === 4 ? { minX: view[0]!, minY: view[1]!, maxX: view[2]!, maxY: view[3]! } : null;
      return { kind: "pdf" as const, ...pdfPrimitives(extracted), inserts: [], bounds };
    } finally {
      await doc.cleanup();
    }
  });
}

/** The sheet's primitives, from the cache when it has been read before. Pictures have none. */
export const loadSheetGeometry: GeometryLoader = async (sheet, pageInFile) => {
  if (PICTURE_PLAN.test(sheet.file_name)) throw new ValidationError(NOT_VECTOR);
  const isDwg = /\.dwg$/i.test(sheet.file_name);
  if (!isDwg && !/\.pdf$/i.test(sheet.file_name)) throw new ValidationError(NOT_VECTOR);
  const cached = path.join(CACHE_DIR, `${sheet.id}.json`);
  const hit = await fs.readFile(cached, "utf8").catch(() => null);
  if (hit !== null) {
    try {
      return JSON.parse(hit) as SheetGeometry;
    } catch {
      // a half-written cache file is re-read from the source below
    }
  }
  const geometry = isDwg ? await readDwg(sheet) : await readPdfPage(sheet, pageInFile);
  await fs.mkdir(CACHE_DIR, { recursive: true }).catch(() => undefined);
  await fs.writeFile(cached, JSON.stringify(geometry), "utf8").catch(() => undefined);
  return geometry;
};

/** Forget a sheet's cached primitives (a re-uploaded or re-framed sheet). */
export async function evictSheetGeometry(sheetId: string): Promise<void> {
  await fs.rm(path.join(CACHE_DIR, `${sheetId}.json`), { force: true }).catch(() => undefined);
}

// PDF pens: only the heavy lines are walls; a DWG has no pen, so every line counts
function wallPen(geo: SheetGeometry): number {
  if (geo.kind !== "pdf") return 0;
  const segments: Segment[] = geo.segments.map((s) => ({ ...s, len: Math.hypot(s.x2 - s.x1, s.y2 - s.y1), color: "" }));
  return wallPenThreshold(segments);
}

type GeometryRepo = Pick<PreconRepository, "sheetById" | "sheetsBySession">;

export function sheetGeometryService(repo: GeometryRepo, load: GeometryLoader = loadSheetGeometry) {
  async function geometryFor(sheetId: string): Promise<{ sheet: PreconSheetRow; geo: SheetGeometry }> {
    const sheet = await repo.sheetById(sheetId);
    if (!sheet) throw new NotFoundError("Sheet");
    // a session's page numbers run across its files; the page inside this file is its rank among its siblings
    const siblings = (await repo.sheetsBySession(sheet.session_id))
      .filter((s) => s.storage_path === sheet.storage_path)
      .sort((a, b) => a.page_number - b.page_number);
    const pageInFile = Math.max(1, siblings.findIndex((s) => s.id === sheet.id) + 1);
    return { sheet, geo: await load(sheet, pageInFile) };
  }

  return {
    async roomAt(sheetId: string, body: RoomAtBody): Promise<RoomAtResult> {
      const { sheet, geo } = await geometryFor(sheetId);
      const { mmPerPt } = scaleAt(sheet, [[body.x, body.y]]);
      const room = roomAt(geo, [body.x, body.y], mmPerPt, { penPt: wallPen(geo) });
      if (!room) throw new AppError("No enclosed space here", { statusCode: 404, code: "not_found" });
      return room;
    },

    async symbolMatches(sheetId: string, body: SymbolMatchesBody): Promise<SymbolMatchesResult> {
      const { geo } = await geometryFor(sheetId);
      const found = symbolMatches(geo, body.rect, { excludeSeed: body.excludeSeed });
      if (!found) throw new AppError("No symbol inside that box", { statusCode: 404, code: "not_found" });
      return found;
    },
  };
}

export type SheetGeometryService = ReturnType<typeof sheetGeometryService>;

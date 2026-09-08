import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import { CONVENTIONS, buildDrawing } from "./conventions.ts";
import { writeDxf } from "./dxf-writer.ts";
import { writeLibredwgJson } from "./libredwg-json.ts";
import { writePdf } from "./pdf-writer.ts";
import { FAMILIES, type Convention, type Family, type Truth } from "./types.ts";

const run = promisify(execFile);

// A fixture is one family drawn one way: its DXF and truth manifest are
// committed; the DWG (via LibreDWG) and the PDF are produced on demand so the
// repository stays small and the writers stay the source of truth.

export interface Fixture {
  id: string;
  family: Family;
  convention: Convention;
  dir: string;
  dxf: string;
  json: string;
  dwg: string;
  pdf: string;
  truthPath: string;
}

// packages/backend/benchmark/fixtures, independent of the working directory
export const FIXTURES_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../../benchmark/fixtures");

export function fixtureId(family: Family, convention: Convention): string {
  return `${family}__${convention.id}`;
}

export function fixturePaths(root: string, family: Family, convention: Convention): Fixture {
  const id = fixtureId(family, convention);
  const dir = path.join(root, id);
  return {
    id,
    family,
    convention,
    dir,
    dxf: path.join(dir, "drawing.dxf"),
    json: path.join(dir, "drawing.libredwg.json"),
    dwg: path.join(dir, "drawing.dwg"),
    pdf: path.join(dir, "drawing.pdf"),
    truthPath: path.join(dir, "truth.json"),
  };
}

export async function hasDwgwrite(): Promise<boolean> {
  try {
    await run("dwgwrite", ["--help"]);
    return true;
  } catch {
    return false;
  }
}

export interface GenerateOptions {
  root?: string;
  families?: readonly Family[];
  conventions?: readonly Convention[];
  // write the DWG and PDF too (needs dwgwrite for the DWG)
  binaries?: boolean;
}

export interface GenerateResult {
  fixture: Fixture;
  truth: Truth;
  dwgWritten: boolean;
  dwgError: string | null;
  pdfWritten: boolean;
}

export async function generateFixture(family: Family, convention: Convention, opts: GenerateOptions = {}): Promise<GenerateResult> {
  const root = opts.root ?? FIXTURES_ROOT;
  const fixture = fixturePaths(root, family, convention);
  await fs.mkdir(fixture.dir, { recursive: true });
  const { drawing, truth } = buildDrawing(family, convention);
  await fs.writeFile(fixture.dxf, writeDxf(drawing), "utf8");
  await fs.writeFile(fixture.json, writeLibredwgJson(drawing), "utf8");
  await fs.writeFile(fixture.truthPath, JSON.stringify(truth, null, 2), "utf8");
  let dwgWritten = false;
  let dwgError: string | null = null;
  let pdfWritten = false;
  if (opts.binaries !== false) {
    try {
      // LibreDWG's JSON import keeps layer, block and dimension references
      // that its DXF import drops; -y because it refuses to overwrite otherwise
      await run("dwgwrite", ["-y", "-I", "JSON", "-o", fixture.dwg, fixture.json], { maxBuffer: 64 * 1024 * 1024 });
      dwgWritten = true;
    } catch (error) {
      dwgError = error instanceof Error ? error.message.split("\n")[0]! : String(error);
    }
    await fs.writeFile(fixture.pdf, await writePdf(drawing));
    pdfWritten = true;
  }
  return { fixture, truth, dwgWritten, dwgError, pdfWritten };
}

export async function generateAll(opts: GenerateOptions = {}): Promise<GenerateResult[]> {
  const out: GenerateResult[] = [];
  for (const family of opts.families ?? FAMILIES) {
    for (const convention of opts.conventions ?? CONVENTIONS) {
      out.push(await generateFixture(family, convention, opts));
    }
  }
  return out;
}

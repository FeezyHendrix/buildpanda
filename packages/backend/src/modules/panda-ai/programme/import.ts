import { parseMppBuffer, parseXlsBuffer, type ParsedProgramme } from "./parser.ts";
import { structureProgramme, type StructuredProgramme } from "./structure.ts";

function fileBaseName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base || "Imported Project";
}

function detectKind(fileName: string): "mpp" | "xls" {
  return /\.mpp$/i.test(fileName) ? "mpp" : "xls";
}

export async function extractProgramme(
  buffer: Buffer,
  fileName: string,
  tmpDir: string,
): Promise<StructuredProgramme> {
  const kind = detectKind(fileName);
  let parsed: ParsedProgramme;
  if (kind === "mpp") {
    parsed = await parseMppBuffer(buffer, tmpDir);
  } else {
    parsed = parseXlsBuffer(buffer);
  }
  return structureProgramme(parsed, fileBaseName(fileName));
}

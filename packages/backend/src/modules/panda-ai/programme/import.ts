import { parseMppBuffer, parseXlsBuffer, parseXmlBuffer, type ParsedProgramme } from "./parser.ts";
import { structureProgramme, type StructuredProgramme } from "./structure.ts";

function fileBaseName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base || "Imported Project";
}

function detectKind(fileName: string): "mpp" | "xml" | "xls" {
  if (/\.mpp$/i.test(fileName)) return "mpp";
  if (/\.xml$/i.test(fileName)) return "xml";
  return "xls";
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
  } else if (kind === "xml") {
    parsed = await parseXmlBuffer(buffer);
  } else {
    parsed = parseXlsBuffer(buffer);
  }
  return structureProgramme(parsed, fileBaseName(fileName));
}

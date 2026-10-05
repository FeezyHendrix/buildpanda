import type { ExtractedPage } from "./measure-file.ts";
import type { PreconSheetRow, SheetKind } from "../types.ts";
import type { withTempFile } from "./measure-sheet.ts";

export interface DrawingEvidence {
  regions: { title: string; kind: SheetKind; lines: string[] }[];
  warnings: string[];
}

export interface ReadDrawingPage extends ExtractedPage {
  globalPage: number;
  label: string;
  evidence: DrawingEvidence | null;
}

export interface ReadDrawingFile {
  sheet: PreconSheetRow;
  pages: ReadDrawingPage[];
  error: string | null;
}

export type DrawingVisionCall = (prompt: string, images: string[], options: { detail: "high" }) => Promise<string | null>;

export interface DrawingReadDependencies {
  withFile: typeof withTempFile;
  readEvidence: ((label: string, images: Buffer[]) => Promise<DrawingEvidence | null>) | null;
}

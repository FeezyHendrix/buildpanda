export const MARKUP_KINDS = ["pin", "pen", "cloud", "measure"] as const;
export type MarkupKind = (typeof MARKUP_KINDS)[number];

export interface MarkupPoint {
  x: number;
  y: number;
}

export interface MarkupRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Percentages of the rendered sheet, so geometry survives any zoom or DPI. */
export type MarkupGeometry =
  | { kind: "pin"; at: MarkupPoint }
  | { kind: "pen"; points: MarkupPoint[] }
  | { kind: "cloud"; rect: MarkupRect }
  | { kind: "measure"; a: MarkupPoint; b: MarkupPoint };

export const SHEET_TOOLS = ["navigate", "pin", "pen", "cloud"] as const;
export type SheetTool = (typeof SHEET_TOOLS)[number];

export interface SheetMarkup {
  id: string;
  kind: MarkupKind;
  geometry: MarkupGeometry;
  color: string;
  resolved: boolean;
}

export interface SheetRenderInfo {
  aspect: number;
  pageCount: number;
}

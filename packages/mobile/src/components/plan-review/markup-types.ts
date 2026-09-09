export const MARKUP_KINDS = ["pin", "pen", "cloud", "measure"] as const;
export type MarkupKind = (typeof MARKUP_KINDS)[number];

export const MARKUP_KIND = {
  PIN: "pin",
  PEN: "pen",
  CLOUD: "cloud",
  MEASURE: "measure",
} as const satisfies Record<string, MarkupKind>;

export const MEDIA_KINDS = ["audio", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_KIND = {
  AUDIO: "audio",
  VIDEO: "video",
} as const satisfies Record<string, MediaKind>;

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

export const SHEET_TOOLS = ["pan", "comment", "pen", "cloud"] as const;
export type SheetTool = (typeof SHEET_TOOLS)[number];

export const SHEET_TOOL = {
  PAN: "pan",
  COMMENT: "comment",
  PEN: "pen",
  CLOUD: "cloud",
} as const satisfies Record<string, SheetTool>;

export interface CommentDraft {
  text: string;
  mediaKind: MediaKind | null;
  mediaUri: string | null;
  mediaDurationSeconds: number | null;
  assigneeId: string | null;
}

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

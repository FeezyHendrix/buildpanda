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

/**
 * Which space a markup's numbers are in. "percent" is percentages of the
 * rendered sheet: it survives any zoom but carries no scale, so a length
 * drawn that way is not a quantity. "points" is the take-off sheet space,
 * which a calibrated sheet turns into millimetres.
 */
export const GEOMETRY_SPACES = ["percent", "points"] as const;
export type GeometrySpace = (typeof GEOMETRY_SPACES)[number];

type MarkupShape =
  | { kind: "pin"; at: MarkupPoint }
  | { kind: "pen"; points: MarkupPoint[] }
  | { kind: "cloud"; rect: MarkupRect }
  | { kind: "measure"; a: MarkupPoint; b: MarkupPoint };

export type MarkupGeometry = MarkupShape & { space?: GeometrySpace };

// Cloud is no longer offered: a revision cloud is a drafting convention for
// "this changed", and the revision compare says that better. Existing clouds
// still render, they just cannot be drawn any more.
export const SHEET_TOOLS = ["pan", "comment", "pen"] as const;
export type SheetTool = (typeof SHEET_TOOLS)[number];

export const SHEET_TOOL = {
  PAN: "pan",
  COMMENT: "comment",
  PEN: "pen",
} as const satisfies Record<string, SheetTool>;

// A sheet carries pen and comments; a reader wants one without the other.
export const SHEET_LAYERS = ["ink", "comments"] as const;
export type SheetLayer = (typeof SHEET_LAYERS)[number];
export type LayerVisibility = Record<SheetLayer, boolean>;
export const ALL_LAYERS_VISIBLE: LayerVisibility = { ink: true, comments: true };

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

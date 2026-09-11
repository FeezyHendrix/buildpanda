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

// Cloud was once dropped here on the grounds that the revision compare says
// "this changed" better. The web draws revision clouds (plan-review-toolbar),
// so an office markup can arrive as a cloud and the field must be able to
// answer in kind — the tool set mirrors the web's, minus its mouse-only Select.
export const SHEET_TOOLS = ["pan", "comment", "pen", "cloud", "measure"] as const;
export type SheetTool = (typeof SHEET_TOOLS)[number];

export const SHEET_TOOL = {
  PAN: "pan",
  COMMENT: "comment",
  PEN: "pen",
  CLOUD: "cloud",
  MEASURE: "measure",
} as const satisfies Record<string, SheetTool>;

/**
 * The web's markup palette (packages/frontend plan-review-types.ts
 * MARKUP_COLORS), same hex values so a colour chosen here reads the same on
 * the office screen. These are not tailwind tokens — they are markup ink,
 * chosen to contrast with a drawing — so they live here, not in `palette`.
 */
export const MARKUP_COLORS = [
  { value: "#004DE7", label: "Blue" },
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#111827", label: "Black" },
] as const;
export type MarkupColor = (typeof MARKUP_COLORS)[number]["value"];
export const DEFAULT_MARKUP_COLOR: MarkupColor = MARKUP_COLORS[0].value;

// A sheet carries pen and comments; a reader wants one without the other.
// Clouds ride with the ink layer: both are drawn marks, and a sheet with ink
// hidden is a sheet with nothing drawn on it.
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
  /** The rail's markup colour, for the pin this comment anchors to. */
  color?: string;
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

/**
 * A sheet's calibrated scale: metres per percent of sheet width, set by a
 * user drawing a line along a known length. Per revision, kept on the
 * device — it is a reading aid, not a record, so it has no server row.
 */
export interface SheetScale {
  metresPerPct: number;
  calibratedAt: number;
}

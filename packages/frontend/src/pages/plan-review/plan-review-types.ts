import { Cloud, Hand, MessageSquarePlus, MousePointer2, Pen, Ruler } from "lucide-react";
import { MARKUP_KIND, type DrawingMarkup } from "@/api/drawing-markup";
import type { Markup } from "./plan-review-markup";
import { clamp, type Sheet } from "./plan-review-data";
export type Tool = "pan" | "select" | "measure" | "pen" | "cloud" | "comment";
export type BlendMode = "differences" | "ghost" | "highlight";
export type RecStatus = "idle" | "recording" | "saved";
export type SelectionKind = "pin" | "markup";

export const TOOL = {
  PAN: "pan",
  SELECT: "select",
  MEASURE: "measure",
  PEN: "pen",
  CLOUD: "cloud",
  COMMENT: "comment",
} as const satisfies Record<string, Tool>;

export const BLEND_MODE = {
  DIFFERENCES: "differences",
  GHOST: "ghost",
  HIGHLIGHT: "highlight",
} as const satisfies Record<string, BlendMode>;

export const REC_STATUS = {
  IDLE: "idle",
  RECORDING: "recording",
  SAVED: "saved",
} as const satisfies Record<string, RecStatus>;

export const SELECTION_KIND = {
  PIN: "pin",
  MARKUP: "markup",
} as const satisfies Record<string, SelectionKind>;

export const KEY = {
  ESCAPE: "Escape",
  ENTER: "Enter",
  DELETE: "Delete",
  BACKSPACE: "Backspace",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  SLASH: "/",
} as const;

export const CALIBRATED_LABEL = "calibrated";
export type PopoverId =
  | "search"
  | "revision"
  | "reviewTools"
  | "color"
  | "paneOptsPrimary"
  | "paneOptsCompare";

export const POPOVER = {
  SEARCH: "search",
  REVISION: "revision",
  REVIEW_TOOLS: "reviewTools",
  COLOR: "color",
  PANE_OPTS_PRIMARY: "paneOptsPrimary",
  PANE_OPTS_COMPARE: "paneOptsCompare",
} as const satisfies Record<string, PopoverId>;

export type PaneSide = "primary" | "compare";

export const PANE = {
  PRIMARY: "primary",
  COMPARE: "compare",
} as const satisfies Record<string, PaneSide>;

export const PARTICIPANT_ACTIVE = "active";

export interface Pin {
  id: string;
  sheetId: string;
  x: number;
  y: number;
  color: string;
  noteId: string | null;
}

export function toLocalMarkup(server: DrawingMarkup[]): { pins: Pin[]; markups: Markup[] } {
  const pins: Pin[] = [];
  const markups: Markup[] = [];
  for (const item of server) {
    const base = { id: item.id, sheetId: item.documentId, color: item.color };
    const g = item.geometry;
    if (g.kind === MARKUP_KIND.PIN) {
      pins.push({ ...base, x: g.at.x, y: g.at.y, noteId: item.comments[0]?.id ?? null });
    } else if (g.kind === MARKUP_KIND.PEN) {
      markups.push({ ...base, tool: "pen", points: g.points });
    } else if (g.kind === MARKUP_KIND.CLOUD) {
      markups.push({ ...base, tool: "cloud", rect: g.rect });
    } else {
      markups.push({ ...base, tool: "measure", a: g.a, b: g.b });
    }
  }
  return { pins, markups };
}

export type NoteType = "comment" | "recording";

export const NOTE_TYPE = {
  COMMENT: "comment",
  RECORDING: "recording",
} as const satisfies Record<string, NoteType>;

export interface Note {
  id: string;
  type: NoteType;
  text: string;
  author: string;
  createdAt: number;
  sheetId: string;
  pinId: string | null;
  durationSeconds: number | null;
}

export type Selection = { kind: SelectionKind; id: string } | null;

export const TOOLS: { id: Tool; label: string; shortcut: string; Icon: typeof Hand }[] = [
  { id: "pan", label: "Pan", shortcut: "H", Icon: Hand },
  { id: "select", label: "Select", shortcut: "V", Icon: MousePointer2 },
  { id: "measure", label: "Measure", shortcut: "M", Icon: Ruler },
  { id: "pen", label: "Pen", shortcut: "P", Icon: Pen },
  { id: "cloud", label: "Cloud", shortcut: "C", Icon: Cloud },
  { id: "comment", label: "Comment", shortcut: "N", Icon: MessageSquarePlus },
];

export const MARKUP_COLORS = [
  { value: "#004DE7", label: "Blue" },
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#111827", label: "Black" },
];

export const REVISIONS = ["Rev A", "Rev B", "Rev C"];
export const BLEND_MODES: { id: BlendMode; label: string }[] = [
  { id: BLEND_MODE.DIFFERENCES, label: "Differences" },
  { id: BLEND_MODE.GHOST, label: "Ghost" },
  { id: BLEND_MODE.HIGHLIGHT, label: "Highlight" },
];
export const PLAYBACK_SECONDS = 4;
export const TOOL_CURSORS: Record<Tool, string> = {
  pan: "cursor-grab",
  select: "cursor-default",
  measure: "cursor-crosshair",
  pen: "cursor-crosshair",
  cloud: "cursor-crosshair",
  comment: "cursor-crosshair",
};

export function sheetAt(sheets: Sheet[], index: number): Sheet {
  const found = sheets[clamp(index, 0, sheets.length - 1)];
  if (!found) throw new Error("sheet index out of range");
  return found;
}

import { Hand, MessageSquarePlus, MousePointer2, Pen, Ruler } from "lucide-react";
import { MARKUP_KIND, type DrawingMarkup } from "@/api/drawing-markup";
import type { Markup } from "./plan-review-markup";
import { clamp, type Sheet } from "./plan-review-data";

export type Tool = "pan" | "select" | "measure" | "pen" | "comment";
export const TOOL = { PAN: "pan", SELECT: "select", MEASURE: "measure", PEN: "pen", COMMENT: "comment" } as const satisfies Record<string, Tool>;
export type SelectionKind = "pin" | "markup";
export const SELECTION_KIND = { PIN: "pin", MARKUP: "markup" } as const satisfies Record<string, SelectionKind>;
export type Selection = { kind: SelectionKind; id: string } | null;
export const KEY = { ESCAPE: "Escape", ENTER: "Enter", DELETE: "Delete", BACKSPACE: "Backspace", ARROW_LEFT: "ArrowLeft", ARROW_RIGHT: "ArrowRight" } as const;
export const CALIBRATED_LABEL = "calibrated";
export const PARTICIPANT_ACTIVE = "active";

export interface Pin {
  id: string;
  sheetId: string;
  x: number;
  y: number;
  color: string;
  noteId: string | null;
}

/** Existing clouds remain readable even though cloud creation is no longer offered. */
export function toLocalMarkup(server: DrawingMarkup[]): { pins: Pin[]; markups: Markup[] } {
  const pins: Pin[] = [];
  const markups: Markup[] = [];
  for (const item of server) {
    if (item.documentId === null) continue;
    const base = { id: item.id, sheetId: item.documentId, color: item.color };
    const g = item.geometry;
    if (g.kind === MARKUP_KIND.PIN) pins.push({ ...base, x: g.at.x, y: g.at.y, noteId: item.comments[0]?.id ?? null });
    else if (g.kind === MARKUP_KIND.PEN) markups.push({ ...base, tool: "pen", points: g.points });
    else if (g.kind === MARKUP_KIND.CLOUD) markups.push({ ...base, tool: "cloud", rect: g.rect });
    else markups.push({ ...base, tool: "measure", a: g.a, b: g.b });
  }
  return { pins, markups };
}

export const TOOLS: { id: Tool; label: string; shortcut: string; Icon: typeof Hand }[] = [
  { id: "pan", label: "Pan", shortcut: "H", Icon: Hand },
  { id: "select", label: "Select", shortcut: "V", Icon: MousePointer2 },
  { id: "measure", label: "Measure", shortcut: "M", Icon: Ruler },
  { id: "pen", label: "Pen", shortcut: "P", Icon: Pen },
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
export const TOOL_CURSORS: Record<Tool, string> = {
  pan: "cursor-grab", select: "cursor-default", measure: "cursor-crosshair", pen: "cursor-crosshair", comment: "cursor-crosshair",
};
export function sheetAt(sheets: Sheet[], index: number): Sheet {
  const found = sheets[clamp(index, 0, sheets.length - 1)];
  if (!found) throw new Error("sheet index out of range");
  return found;
}

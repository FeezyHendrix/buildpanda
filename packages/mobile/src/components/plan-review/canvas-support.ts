import type { CSSProperties } from "react";
import type { MarkupPoint } from "./markup-types";

// iOS WKWebView refuses canvases past ~16.7M pixels; stay safely under.
export const MAX_CANVAS_PIXELS = 14_000_000;
export const BASE_SCALE = 1.6;
export const DEFAULT_ASPECT = 0.775;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
export const TAP_SLOP_PX = 8;
export const PEN_MIN_STEP_PCT = 0.35;
// the web's floors (use-markup-tools.ts): a cloud smaller than this is a slip,
// a measure shorter than this is a tap that meant to place its first point
export const CLOUD_MIN_SIZE_PCT = 1;
export const MEASURE_MIN_LEN_PCT = 0.5;

export interface Transform {
  s: number;
  tx: number;
  ty: number;
}

export type GestureMode = "idle" | "pan" | "pinch" | "pen" | "tap" | "cloud" | "measure";

export const GESTURE_MODE = {
  IDLE: "idle",
  PAN: "pan",
  PINCH: "pinch",
  PEN: "pen",
  TAP: "tap",
  CLOUD: "cloud",
  MEASURE: "measure",
} as const satisfies Record<string, GestureMode>;

/** The gestures during which the loupe rides the finger: a point is being placed. */
export const LOUPE_MODES: readonly GestureMode[] = [GESTURE_MODE.PEN, GESTURE_MODE.TAP, GESTURE_MODE.MEASURE];

export interface Gesture {
  mode: GestureMode;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  startPct: MarkupPoint | null;
  /** Where the measure being drawn starts: the first tap, or where the drag began. */
  measureFrom: MarkupPoint | null;
  pinchDist: number;
  pinchScale: number;
  pinchTx: number;
  pinchTy: number;
  pinchMidX: number;
  pinchMidY: number;
}

export const IDLE_GESTURE: Gesture = {
  mode: GESTURE_MODE.IDLE,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  moved: false,
  startPct: null,
  measureFrom: null,
  pinchDist: 0,
  pinchScale: 1,
  pinchTx: 0,
  pinchTy: 0,
  pinchMidX: 0,
  pinchMidY: 0,
};

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.85)",
};

/** Keep the sheet from being dragged off the viewport at any zoom. */
export function clampTransform(t: Transform, box: { w: number; h: number }, viewport: { w: number; h: number }): Transform {
  const w = box.w * t.s;
  const h = box.h * t.s;
  return {
    s: t.s,
    tx: clamp(t.tx, Math.min(0, viewport.w - w), Math.max(0, viewport.w - w)),
    ty: clamp(t.ty, Math.min(0, viewport.h - h), Math.max(0, viewport.h - h)),
  };
}

export const FIT_TRANSFORM: Transform = { s: 1, tx: 0, ty: 0 };

type Pt = { x: number; y: number };

/** Remember where a pinch began so its zoom can stay anchored under the fingers. */
export function beginPinch(g: Gesture, p1: Pt, p2: Pt, t: Transform, vp: { left: number; top: number }): void {
  g.mode = GESTURE_MODE.PINCH;
  g.pinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  g.pinchScale = t.s;
  g.pinchTx = t.tx;
  g.pinchTy = t.ty;
  g.pinchMidX = (p1.x + p2.x) / 2 - vp.left;
  g.pinchMidY = (p1.y + p2.y) / 2 - vp.top;
}

/** The transform a pinch has reached, before viewport clamping; null while it has no reference. */
export function pinchTransform(g: Gesture, p1: Pt, p2: Pt, vp: { left: number; top: number }): Transform | null {
  if (g.pinchDist <= 0) return null;
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const s = clamp(g.pinchScale * (dist / g.pinchDist), MIN_ZOOM, MAX_ZOOM);
  const midX = (p1.x + p2.x) / 2 - vp.left;
  const midY = (p1.y + p2.y) / 2 - vp.top;
  const ratio = s / g.pinchScale;
  return {
    s,
    tx: midX - ratio * (g.pinchMidX - g.pinchTx),
    ty: midY - ratio * (g.pinchMidY - g.pinchTy),
  };
}

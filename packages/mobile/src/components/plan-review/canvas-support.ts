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

export interface Transform {
  s: number;
  tx: number;
  ty: number;
}

export type GestureMode = "idle" | "pan" | "pinch" | "pen" | "cloud" | "tap";

export const GESTURE_MODE = {
  IDLE: "idle",
  PAN: "pan",
  PINCH: "pinch",
  PEN: "pen",
  CLOUD: "cloud",
  TAP: "tap",
} as const satisfies Record<string, GestureMode>;

export interface Gesture {
  mode: GestureMode;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  startPct: MarkupPoint | null;
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

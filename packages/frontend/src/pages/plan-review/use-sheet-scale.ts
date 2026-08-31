import { useState } from "react";
import { MARKUP_KIND } from "@/api/drawing-markup";
import { toast } from "@/lib/toast";
import { type Markup } from "./plan-review-markup";
import { CALIBRATED_LABEL } from "./plan-review-types";

/** Fallback page aspect (w/h) before a sheet reports its real dimensions. */
const DEFAULT_ASPECT = 0.775;

interface SheetRenderState {
  aspect: number;
  detectedScale: { label: string; feetPerPct: number } | null;
  pageCount?: number;
}

export interface SheetScaleController {
  imgAspect: number;
  /** Feet-per-percent for a sheet once detected or calibrated; undefined until then. */
  scaleFor: (sheetId: string) => number | undefined;
  /** Human-readable scale label for a sheet; undefined until detected or calibrated. */
  labelFor: (sheetId: string) => string | undefined;
  calibrateOpen: boolean;
  calibrateInput: string;
  setCalibrateOpen: (open: boolean) => void;
  setCalibrateInput: (value: string) => void;
  /** Record a sheet's rendered aspect, page count and any auto-detected scale. */
  applyRender: (sheetId: string | null, state: SheetRenderState) => void;
  /** Derive a sheet's scale from a drawn measure line of known real-world length. */
  calibrate: (sheetId: string, measureMarkup: Markup | null) => void;
}

/**
 * Per-sheet drawing scale: the rendered aspect ratio, auto-detected scale from
 * the sheet's title block, and manual calibration off a measure line. Detected
 * and calibrated values are keyed by sheet id so switching sheets keeps each
 * sheet's own scale; a first detection never overwrites an existing value.
 */
export function useSheetScale(onPageCount: (count: number) => void): SheetScaleController {
  const [imgAspect, setImgAspect] = useState(DEFAULT_ASPECT);
  const [sheetScales, setSheetScales] = useState<Record<string, number>>({});
  const [scaleLabels, setScaleLabels] = useState<Record<string, string>>({});
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [calibrateInput, setCalibrateInput] = useState("");

  function applyRender(sheetId: string | null, state: SheetRenderState): void {
    setImgAspect(state.aspect);
    if (state.pageCount !== undefined) onPageCount(state.pageCount);
    if (!sheetId || !state.detectedScale) return;
    const detected = state.detectedScale;
    setSheetScales((current) => (current[sheetId] ? current : { ...current, [sheetId]: detected.feetPerPct }));
    setScaleLabels((current) => (current[sheetId] ? current : { ...current, [sheetId]: detected.label }));
  }

  function calibrate(sheetId: string, measureMarkup: Markup | null): void {
    if (!measureMarkup || measureMarkup.tool !== MARKUP_KIND.MEASURE || !calibrateInput) return;
    const feet = Number.parseFloat(calibrateInput);
    if (Number.isNaN(feet) || feet <= 0) return;

    const dxPct = measureMarkup.b.x - measureMarkup.a.x;
    const dyPct = (measureMarkup.b.y - measureMarkup.a.y) * imgAspect;
    const distPct = Math.hypot(dxPct, dyPct);

    setSheetScales((s) => ({ ...s, [sheetId]: feet / distPct }));
    setScaleLabels((s) => ({ ...s, [sheetId]: CALIBRATED_LABEL }));
    setCalibrateOpen(false);
    setCalibrateInput("");
    toast("Scale calibrated", "success");
  }

  return {
    imgAspect,
    scaleFor: (sheetId) => sheetScales[sheetId],
    labelFor: (sheetId) => scaleLabels[sheetId],
    calibrateOpen,
    calibrateInput,
    setCalibrateOpen,
    setCalibrateInput,
    applyRender,
    calibrate,
  };
}

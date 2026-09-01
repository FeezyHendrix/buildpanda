import { useRef, useState } from "react";
import { clamp } from "./plan-review-data";
import { BLEND_MODE, PANE, type BlendMode, type PaneSide } from "./plan-review-types";

const PANE_ZOOM_MIN = 50;
const PANE_ZOOM_MAX = 200;
const DIVIDER_MIN = 0.25;
const DIVIDER_MAX = 0.75;

export interface SplitState {
  open: boolean;
  primaryIndex: number;
  compareIndex: number;
  primaryZoom: number;
  compareZoom: number;
  locked: boolean;
  synced: boolean;
  dividerRatio: number;
}

const INITIAL_SPLIT: SplitState = {
  open: false,
  primaryIndex: 0,
  compareIndex: 1,
  primaryZoom: 100,
  compareZoom: 100,
  locked: false,
  synced: false,
  dividerRatio: 0.5,
};

export interface SheetNavigationController {
  activeSheetIndex: number;
  setActiveSheetIndex: React.Dispatch<React.SetStateAction<number>>;
  sheetRevisions: Record<string, string>;
  setSheetRevisions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  compareSheetIndex: number;
  setCompareSheetIndex: React.Dispatch<React.SetStateAction<number>>;
  split: SplitState;
  setSplit: React.Dispatch<React.SetStateAction<SplitState>>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  pdfPage: number;
  setPdfPage: React.Dispatch<React.SetStateAction<number>>;
  pdfPageCount: number;
  setPdfPageCount: React.Dispatch<React.SetStateAction<number>>;
  blendPanelOpen: boolean;
  setBlendPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  blendMode: BlendMode | null;
  setBlendMode: React.Dispatch<React.SetStateAction<BlendMode | null>>;
  blendAmount: number;
  setBlendAmount: React.Dispatch<React.SetStateAction<number>>;
  splitStageRef: React.RefObject<HTMLDivElement | null>;
  /** Clamp to a valid sheet index and run the caller's reset (clears in-progress markup). */
  goTo: (index: number) => void;
  setPaneZoom: (pane: PaneSide, nextZoom: number) => void;
  startDividerDrag: (e: React.MouseEvent) => void;
  /** Open the blend panel, defaulting to the differences overlay on first open. */
  openBlend: () => void;
}

/**
 * Sheet-selection and view state: which sheet(s) are shown, single vs split
 * compare, zoom, PDF page, and the blend overlay. Purely navigational — it owns
 * no markup; {@link goTo} defers the in-progress-markup reset to the caller.
 */
export function useSheetNavigation(sheetCount: number, onSheetChange: () => void): SheetNavigationController {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [sheetRevisions, setSheetRevisions] = useState<Record<string, string>>({});
  const [compareSheetIndex, setCompareSheetIndex] = useState(1);
  const [split, setSplit] = useState<SplitState>(INITIAL_SPLIT);
  const [zoom, setZoom] = useState(100);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [blendPanelOpen, setBlendPanelOpen] = useState(false);
  const [blendMode, setBlendMode] = useState<BlendMode | null>(null);
  const [blendAmount, setBlendAmount] = useState(50);
  const splitStageRef = useRef<HTMLDivElement>(null);

  function goTo(index: number): void {
    setActiveSheetIndex(clamp(index, 0, sheetCount - 1));
    onSheetChange();
  }

  function setPaneZoom(pane: PaneSide, nextZoom: number): void {
    const next = clamp(nextZoom, PANE_ZOOM_MIN, PANE_ZOOM_MAX);
    setSplit((s) => ({
      ...s,
      primaryZoom: pane === PANE.PRIMARY || s.synced ? next : s.primaryZoom,
      compareZoom: pane === PANE.COMPARE || s.synced ? next : s.compareZoom,
    }));
  }

  function startDividerDrag(e: React.MouseEvent): void {
    e.preventDefault();
    function onMove(ev: MouseEvent): void {
      const rect = splitStageRef.current?.getBoundingClientRect();
      if (!rect) return;
      setSplit((s) => ({ ...s, dividerRatio: clamp((ev.clientX - rect.left) / rect.width, DIVIDER_MIN, DIVIDER_MAX) }));
    }
    function onUp(): void {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function openBlend(): void {
    setBlendPanelOpen(true);
    setBlendMode((m) => m ?? BLEND_MODE.DIFFERENCES);
  }

  return {
    activeSheetIndex,
    setActiveSheetIndex,
    sheetRevisions,
    setSheetRevisions,
    compareSheetIndex,
    setCompareSheetIndex,
    split,
    setSplit,
    zoom,
    setZoom,
    pdfPage,
    setPdfPage,
    pdfPageCount,
    setPdfPageCount,
    blendPanelOpen,
    setBlendPanelOpen,
    blendMode,
    setBlendMode,
    blendAmount,
    setBlendAmount,
    splitStageRef,
    goTo,
    setPaneZoom,
    startDividerDrag,
    openBlend,
  };
}

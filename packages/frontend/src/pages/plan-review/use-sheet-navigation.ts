import { useState } from "react";
import { clamp } from "./plan-review-data";

/** The active drawing, page and zoom. Comparison has its own independent panes. */
export function useSheetNavigation(sheetCount: number, onSheetChange: () => void) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [comparing, setComparing] = useState(false);

  function goTo(index: number): void {
    const nextIndex = clamp(index, 0, Math.max(0, sheetCount - 1));
    if (nextIndex === activeSheetIndex) return;
    setActiveSheetIndex(nextIndex);
    setPdfPage(1);
    setPdfPageCount(1);
    setZoom(100);
    onSheetChange();
  }

  function goToPage(page: number): void {
    setPdfPage(clamp(page, 1, pdfPageCount));
    onSheetChange();
  }

  function toggleCompare(): void {
    setComparing((current) => !current);
    onSheetChange();
  }

  return {
    activeSheetIndex,
    zoom,
    setZoom,
    pdfPage,
    pdfPageCount,
    setPdfPageCount,
    comparing,
    goTo,
    goToPage,
    toggleCompare,
  };
}
export type SheetNavigationController = ReturnType<typeof useSheetNavigation>;

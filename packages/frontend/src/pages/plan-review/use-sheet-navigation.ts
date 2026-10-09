import { useState } from "react";
import { clamp } from "./plan-review-data";

/** The active drawing, page and zoom. Comparison has its own independent panes. */
export function useSheetNavigation(sheetCount: number, onSheetChange: () => void, initialIndex = 0) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(100);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(1);

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

  return {
    activeSheetIndex,
    zoom,
    setZoom,
    pdfPage,
    pdfPageCount,
    setPdfPageCount,
    goTo,
    goToPage,
  };
}
export type SheetNavigationController = ReturnType<typeof useSheetNavigation>;

// WS-M1D — pinned comments on take-off sheets.
//
// Mounting (WS-M1B owns precon-sheet-viewer.tsx and precon-boq-panel.tsx):
//   viewer, inside the transform wrapper next to <SheetOverlay>:
//     <PinLayer key={activeSheet.id} sessionId={sessionId} sheetId={activeSheet.id}
//       widthPx={page.widthPx} heightPx={page.heightPx} toPx={toPx} toPt={toPt}
//       cssZoom={cssZoom} placing={tool === "comment"} selectedRowId={selectedRowId}
//       rowById={rowById} onPlaced={() => onToolChange("select")} onSelectRow={onSelectRow} />
//   bill panel, per row:
//     const counts = useOpenCommentCounts(sessionId);
//     <OpenCommentBadge count={counts.get(row.id) ?? 0} />
export { PinLayer, lineLabelFor, type PinLayerProps } from "./pin-layer";
export { OpenCommentBadge } from "./open-comment-badge";
export { usePreconMarkups, useOpenCommentCounts } from "@/hooks/use-precon-markups";

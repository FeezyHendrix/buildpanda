import { useState } from "react";
import type { Sheet } from "./plan-review-data";
import { SheetImage } from "./plan-review-sheet-image";
import { ReviewPageControls, ReviewZoomControls } from "./review-view-controls";

/** A comparison pane owns the page and zoom for its selected document. */
export function SheetPane({ sheet, label }: { sheet: Sheet; label: string }) {
  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-4">
        <div className="mx-auto" style={{ width: `${zoom}%` }}>
          <SheetImage
            sheet={sheet}
            pageNumber={page}
            onRender={(state) => setPageCount(state.pageCount ?? 1)}
            className="block w-full rounded-lg border border-line bg-white shadow-sm"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-hair p-2">
        <ReviewZoomControls label={label} zoom={zoom} onChange={setZoom} />
        <ReviewPageControls label={label} page={page} count={pageCount} onChange={setPage} />
      </div>
    </>
  );
}
SheetPane.displayName = "SheetPane";

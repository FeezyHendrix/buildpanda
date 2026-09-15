import { useId } from "react";
import { Ruler, Trash2 } from "lucide-react";
import { MARKUP_KIND, type DrawingMarkup } from "@/api/drawing-markup";
import { cn } from "@/lib/utils";
import { sheetPageKey, type Sheet } from "./plan-review-data";
import { MarkupLayer } from "./plan-review-markup";
import { CommentPin } from "@/components/molecules/comment-pin";
import { anchorBelow } from "@/components/molecules/markup-thread/pin-popover";
import { SheetImage } from "./plan-review-sheet-image";
import { SELECTION_KIND, TOOL, TOOL_CURSORS } from "./plan-review-types";
import type { MarkupToolsController } from "./use-markup-tools";
import type { SheetNavigationController } from "./use-sheet-navigation";
import type { SheetScaleController } from "./use-sheet-scale";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { Button } from "@/components/atoms/button";
import { ReviewPageControls, ReviewZoomControls } from "./review-view-controls";

function pinLabel(record: DrawingMarkup | undefined, index: number): string {
  if (!record) return `Comment ${index + 1} (unsaved)`;
  const count = record.comments.length;
  return `${count} comment${count === 1 ? "" : "s"}${record.resolvedAt ? " · resolved" : ""}`;
}
interface PlanReviewStageProps {
  sheet: Sheet;
  nav: SheetNavigationController;
  markup: MarkupToolsController;
  scale: SheetScaleController;
  drawingRef: React.RefObject<HTMLDivElement | null>;
  onCalibrate: () => void;
  label?: string;
}

/** The drawing fills the page; controls stay outside its scrolling surface. */
export function PlanReviewStage({ sheet, nav, markup, scale, drawingRef, onCalibrate, label }: PlanReviewStageProps) {
  const calibrationId = useId();
  const selection = markup.selection;
  const selectedMarkup =
    selection?.kind === SELECTION_KIND.MARKUP ? markup.sheetMarkups.find((item) => item.id === selection.id) : null;
  const measurementSelected = selectedMarkup?.tool === MARKUP_KIND.MEASURE;
  const localSelection = selection && !markup.serverMarkups.has(selection.id);
  return (
    <div className="relative min-h-0 flex-1">
      <div ref={markup.canvasRef} className="h-full overflow-auto bg-gray-100 p-4 pb-20 sm:p-6 sm:pb-20">
        <div className="mx-auto" style={{ width: `${nav.zoom}%` }}>
          <div
            ref={drawingRef}
            data-plan-drawing
            onClick={markup.handleDrawingClick}
            onPointerDown={markup.handlePointerDown}
            onPointerMove={markup.handlePointerMove}
            onPointerUp={markup.handlePointerUp}
            className={cn(
              "relative w-full touch-none rounded-lg border border-line bg-white shadow-sm",
              markup.isPanning ? "cursor-grabbing" : TOOL_CURSORS[markup.activeTool],
            )}
          >
            <SheetImage
              sheet={sheet}
              className="block w-full rounded-lg"
              pageNumber={nav.pdfPage}
              onRender={(state) => scale.applyRender(sheetPageKey(sheet, nav.pdfPage), state)}
            />
            {markup.markupVisible ? (
              <MarkupLayer
                markups={markup.sheetMarkups}
                draft={markup.draft ?? markup.measureDraft}
                selectedId={selection?.kind === SELECTION_KIND.MARKUP ? selection.id : null}
                dimmedIds={markup.dimmedIds}
                scale={sheet.scale}
                aspect={scale.imgAspect}
                customFtPerPct={scale.scaleFor(sheetPageKey(sheet, nav.pdfPage))}
              />
            ) : null}
            {markup.markupVisible
              ? markup.sheetPins.map((pin, index) => {
                  const record = markup.serverMarkups.get(pin.id);
                  const selecting = markup.activeTool === TOOL.SELECT;
                  return (
                    <CommentPin
                      key={pin.id}
                      color={pin.color}
                      label={pinLabel(record, index)}
                      selected={selection?.kind === SELECTION_KIND.PIN && selection.id === pin.id}
                      draggable={selecting && !record}
                      dimmed={markup.dimmedIds.has(pin.id)}
                      onPointerDown={(event) => {
                        if (record) {
                          if (selecting) event.stopPropagation();
                        } else markup.handlePinPointerDown(event, pin.id);
                      }}
                      onClick={(event) => {
                        if (!selecting) return;
                        event.stopPropagation();
                        if (record) markup.openThread(pin.id, anchorBelow(event.currentTarget));
                      }}
                      style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                    />
                  );
                })
              : null}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-2">
        <div className="pointer-events-auto">
          <ReviewZoomControls label={label} zoom={nav.zoom} onChange={nav.setZoom} />
        </div>
        <div className="pointer-events-auto">
          <ReviewPageControls label={label} page={nav.pdfPage} count={nav.pdfPageCount} onChange={nav.goToPage} />
        </div>
      </div>
      {selection && (measurementSelected || localSelection) ? (
        <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-line bg-white p-1 shadow-sm">
          {measurementSelected ? (
            <div className="relative">
              <Button variant="ghost" size="sm" onClick={() => scale.setCalibrateOpen(!scale.calibrateOpen)}>
                <Ruler size={13} /> Calibrate
              </Button>
              {scale.calibrateOpen ? (
                <div
                  data-popover-root
                  className="absolute left-1/2 top-full mt-2 w-64 -translate-x-1/2 rounded-lg border border-line bg-white p-3 shadow-lg"
                >
                  <label htmlFor={calibrationId} className="text-xs font-semibold text-gray-900">
                    Actual distance (feet)
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      id={calibrationId}
                      type="number"
                      min="0"
                      step="any"
                      value={scale.calibrateInput}
                      onChange={(event) => scale.setCalibrateInput(event.target.value)}
                      placeholder="e.g. 10.5"
                      className={INPUT_SM_CLASS}
                    />
                    <Button
                      size="sm"
                      onClick={onCalibrate}
                      disabled={!Number.isFinite(Number(scale.calibrateInput)) || Number(scale.calibrateInput) <= 0}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {localSelection ? (
            <Button variant="danger" size="sm" onClick={markup.deleteSelection}>
              <Trash2 size={13} /> Delete
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
PlanReviewStage.displayName = "PlanReviewStage";

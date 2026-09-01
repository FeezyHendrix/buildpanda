import { Minus, Plus, Ruler, Trash2 } from "lucide-react";
import { MARKUP_KIND } from "@/api/drawing-markup";
import { cn } from "@/lib/utils";
import { clamp, type Sheet } from "./plan-review-data";
import { MarkupLayer } from "./plan-review-markup";
import { CommentPin } from "./plan-review-pin";
import { SheetImage } from "./plan-review-sheet-image";
import { BLEND_MODE, REC_STATUS, SELECTION_KIND, TOOL, TOOL_CURSORS } from "./plan-review-types";
import { IconBtn, Kbd } from "./plan-review-ui";
import type { MarkupToolsController } from "./use-markup-tools";
import type { RecordingController } from "./use-plan-recording";
import type { SheetNavigationController } from "./use-sheet-navigation";
import type { SheetScaleController } from "./use-sheet-scale";

const ZOOM_MIN = 50;
const ZOOM_MAX = 300;
const ZOOM_STEP = 25;

interface PlanReviewStageProps {
  sheet: Sheet;
  /** Revision overlay: the compare sheet washed over the current one. */
  blend: { ready: boolean; compareSheet: Sheet | null; currentRevision: string };
  nav: SheetNavigationController;
  markup: MarkupToolsController;
  scale: SheetScaleController;
  recording: RecordingController;
  drawingRef: React.RefObject<HTMLDivElement | null>;
  onCalibrate: () => void;
}

/**
 * The single-sheet review canvas: the drawing surface every gesture lands on,
 * the markup and pins drawn over it, the walkthrough trace, and the controls
 * pinned to the viewport (zoom, and the toolbar for whatever is selected).
 */
export function PlanReviewStage({
  sheet,
  blend,
  nav,
  markup,
  scale,
  recording,
  drawingRef,
  onCalibrate,
}: PlanReviewStageProps) {
  const compareSheet = blend.compareSheet;
  const selection = markup.selection;
  return (
    <div ref={markup.canvasRef} className="relative min-h-0 flex-1 overflow-auto bg-[#F0F0F0] p-4 sm:p-8">
      <div className="mx-auto" style={{ width: `${nav.zoom}%`, minWidth: "min(560px, 100%)" }}>
        <div
          ref={drawingRef}
          onClick={markup.handleDrawingClick}
          onPointerDown={markup.handlePointerDown}
          onPointerMove={markup.handlePointerMove}
          onPointerUp={markup.handlePointerUp}
          className={cn(
            "relative w-full touch-none rounded-lg border border-[#E2E2E2] bg-white shadow-lg",
            markup.isPanning ? "cursor-grabbing" : TOOL_CURSORS[markup.activeTool],
          )}
        >
          <SheetImage
            sheet={sheet}
            className="block w-full rounded-lg"
            pageNumber={nav.pdfPage}
            onRender={(state) => scale.applyRender(sheet.id, state)}
          />

          {blend.ready && compareSheet?.src && (
            <>
              <img
                src={compareSheet.src}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full rounded-lg"
                style={
                  nav.blendMode === BLEND_MODE.DIFFERENCES
                    ? { mixBlendMode: "difference", opacity: nav.blendAmount / 100 }
                    : nav.blendMode === BLEND_MODE.GHOST
                      ? { opacity: (nav.blendAmount / 100) * 0.6, filter: "grayscale(0.9)" }
                      : { mixBlendMode: "multiply", opacity: nav.blendAmount / 100 }
                }
              />
              {nav.blendMode === BLEND_MODE.HIGHLIGHT && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-lg bg-yellow-300"
                  style={{ mixBlendMode: "multiply", opacity: (nav.blendAmount / 100) * 0.35 }}
                />
              )}
              <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-red-700 shadow-sm ring-1 ring-black/10">
                <span className="size-2 rounded-full bg-red-500" /> {sheet.code} · {blend.currentRevision} (current)
              </span>
              <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-sky-700 shadow-sm ring-1 ring-black/10">
                <span className="size-2 rounded-full bg-sky-500" /> {compareSheet.code} · {compareSheet.revision} (compare)
              </span>
            </>
          )}

          {markup.markupVisible && (
            <MarkupLayer
              markups={markup.sheetMarkups}
              draft={markup.draft ?? markup.measureDraft}
              selectedId={selection?.kind === SELECTION_KIND.MARKUP ? selection.id : null}
              scale={sheet.scale}
              aspect={scale.imgAspect}
              customFtPerPct={scale.scaleFor(sheet.id)}
            />
          )}

          {markup.markupVisible &&
            markup.sheetPins.map((pin, index) => (
              <CommentPin
                key={pin.id}
                color={pin.color}
                label={`Comment ${index + 1}`}
                selected={selection?.kind === SELECTION_KIND.PIN && selection.id === pin.id}
                draggable={markup.activeTool === TOOL.SELECT}
                onPointerDown={(e) => markup.handlePinPointerDown(e, pin.id)}
                onClick={(e) => {
                  if (markup.activeTool === TOOL.SELECT) e.stopPropagation();
                }}
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              />
            ))}

          {(recording.status === REC_STATUS.RECORDING ||
            (recording.status === REC_STATUS.SAVED && recording.trace.length > 1)) && (
            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <polyline
                points={recording.visibleTrace.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#004DE7"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.55"
                vectorEffect="non-scaling-stroke"
              />
              {recording.traceTip && (
                <circle cx={recording.traceTip.x} cy={recording.traceTip.y} r="1.1" fill="#004DE7" />
              )}
            </svg>
          )}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-30 flex items-center gap-1 rounded-lg bg-white/95 p-1 shadow-lg ring-1 ring-black/5">
        <IconBtn
          label="Zoom out"
          disabled={nav.zoom <= ZOOM_MIN}
          onClick={() => nav.setZoom((z) => clamp(z - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
          className="size-7"
        >
          <Minus size={13} />
        </IconBtn>
        <span className="w-11 text-center font-mono text-[11px] text-gray-600">{nav.zoom}%</span>
        <IconBtn
          label="Zoom in"
          disabled={nav.zoom >= ZOOM_MAX}
          onClick={() => nav.setZoom((z) => clamp(z + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
          className="size-7"
        >
          <Plus size={13} />
        </IconBtn>
      </div>

      {selection && (
        <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 py-1 pl-3 pr-1 shadow-lg ring-1 ring-black/5">
          <span className="text-[11px] font-medium text-gray-600">
            {selection.kind === SELECTION_KIND.PIN ? "Pin selected — drag to move" : "Markup selected"}
          </span>
          {selection.kind === SELECTION_KIND.MARKUP &&
            markup.markups.find((m) => m.id === selection.id)?.tool === MARKUP_KIND.MEASURE && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => scale.setCalibrateOpen(!scale.calibrateOpen)}
                  className="flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 hover:bg-primary-100"
                >
                  <Ruler size={11} /> Calibrate
                </button>
                {scale.calibrateOpen && (
                  <div data-popover-root className="absolute left-1/2 top-full mt-2 w-56 -translate-x-1/2 rounded-xl bg-white p-3 shadow-lg ring-1 ring-black/5">
                    <p className="text-xs font-semibold text-gray-900">Calibrate scale</p>
                    <p className="mt-0.5 text-[11px] text-gray-500">Enter the actual distance for this measurement.</p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        value={scale.calibrateInput}
                        onChange={(e) => scale.setCalibrateInput(e.target.value)}
                        placeholder="Feet (e.g. 10.5)"
                        className="h-8 w-full rounded-md bg-[#F6F6F6] px-2.5 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-primary-600/20"
                      />
                      <button
                        type="button"
                        onClick={onCalibrate}
                        className="h-8 shrink-0 rounded-md bg-primary-600 px-3 text-xs font-semibold text-white hover:bg-primary-700"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          <button
            type="button"
            onClick={markup.deleteSelection}
            className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
          >
            <Trash2 size={11} /> Delete
          </button>
          <Kbd>Del</Kbd>
        </div>
      )}
    </div>
  );
}

PlanReviewStage.displayName = "PlanReviewStage";

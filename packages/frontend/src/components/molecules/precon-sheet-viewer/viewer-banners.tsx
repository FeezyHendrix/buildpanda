import type { PreconBoqRow, PreconSheet, SheetViewport } from "@/api/precon";
import type { PreconTool } from "@/lib/precon-meta";
import { SheetStatusBar } from "./sheet-status-bar";
import { NoScaleBanner, ScalePromptBanner } from "./sheet-banners";
import type { useScalePrompt } from "./use-scale-prompt";
import { RegionEditBanner, ViewportPromptBanner } from "./viewport-prompt";
import { AreaFallbackAction, DetectionBanners } from "./detection-banners";
import type { useViewerTools } from "./use-viewer-tools";

export interface ViewerBannersProps {
  activeSheet: PreconSheet | null;
  tool: PreconTool;
  selectedRow: PreconBoqRow | null;
  redrawing: boolean;
  onToggleRedraw: () => void;
  drawingEnabled: boolean;
  draft: number[][];
  draftViewport: SheetViewport | null;
  scale: ReturnType<typeof useScalePrompt>;
  tools: ReturnType<typeof useViewerTools>;
  onClearDraft: () => void;
  onBackToSelect: () => void;
  onOpenSettings: () => void;
  onDrawScale: () => void;
  /** A tool that cannot run, named with its reason, forwarded to the status bar. */
  notice: { toolLabel: string; reason: string } | null;
  /** The note or load error under everything else. */
  banner: string | null;
}

/**
 * The strip of contextual bars between the toolbar and the canvas: status,
 * missing-scale, drawn-scale prompt, viewport calibration, symbol matches,
 * overlay notice and the error/note line. Pure presentation lifted out of
 * `precon-sheet-viewer.tsx` so the page stays a composition root.
 */
export function ViewerBanners({ activeSheet, tool, selectedRow, redrawing, onToggleRedraw, drawingEnabled, draft, draftViewport, scale, tools, onClearDraft, onBackToSelect, onOpenSettings, onDrawScale, notice, banner }: ViewerBannersProps) {
  const scalePrompt = scale.prompt;
  return (
    <>
      {activeSheet && !scalePrompt && !tools.viewportDraft && !tools.detectionActive ? (
        <SheetStatusBar
          sheet={activeSheet}
          tool={tool}
          selectedRow={selectedRow}
          redrawing={redrawing}
          onToggleRedraw={onToggleRedraw}
          drawingEnabled={drawingEnabled}
          draft={draft}
          viewport={draftViewport}
          notice={notice}
          onFixScale={onDrawScale}
        />
      ) : null}
      {activeSheet && !activeSheet.scaleMmPerPt && !scalePrompt && !tools.viewportDraft ? (
        <NoScaleBanner message={activeSheet.error ?? "No calibrated scale on this sheet."} onOpenSettings={onOpenSettings} onDrawScale={onDrawScale} />
      ) : null}
      {scalePrompt ? (
        <ScalePromptBanner prompt={scalePrompt} previewing={scale.previewing} error={scale.error} onPatch={scale.patch} onPreview={() => void scale.runPreview()} onRedraw={scale.clear} />
      ) : null}
      {tools.regionEdit ? (
        <RegionEditBanner edit={tools.regionEdit} saving={tools.savingViewport} onPatch={tools.patchRegionEdit} onSave={tools.saveRegionEdit} onCancel={tools.cancelRegionEdit} />
      ) : null}
      {tools.viewportDraft ? (
        <ViewportPromptBanner
          draft={tools.viewportDraft}
          saving={tools.savingViewport}
          onChange={(patch) => {
            if (patch.mode || patch.ptLength === null) onClearDraft();
            tools.patchViewport(patch);
          }}
          onSave={tools.saveViewport}
          onDiscard={onBackToSelect}
        />
      ) : null}
      <DetectionBanners detect={tools.detect} />
      <AreaFallbackAction visible={tools.detect.noRoomFound} onDrawArea={tools.detect.fallbackToArea} />
      {tools.overlayOn && tools.previous.status === "ready" ? (
        <p className="border-b border-red-100 bg-red-50 px-3 py-1 text-xs text-red-700">
          Overlay: the previous revision{tools.previous.revision ? ` (rev ${tools.previous.revision})` : ""} in red under this sheet. O to hide.
        </p>
      ) : null}
      {banner ? <p className="border-b border-amber-100 bg-amber-50 px-3 py-1 text-xs text-amber-700">{banner}</p> : null}
    </>
  );
}
ViewerBanners.displayName = "ViewerBanners";

import { CalibrationPreviewPanel } from "./calibration-preview-panel";
import { ViewportImpactPanel } from "./viewport-impact-panel";
import type { useScalePrompt } from "./use-scale-prompt";
import type { useViewerTools } from "./use-viewer-tools";
import { OverlayControls } from "./overlay-controls";

interface Props {
  scale: ReturnType<typeof useScalePrompt>;
  tools: ReturnType<typeof useViewerTools>;
  onOpenRow: (rowId: string) => void;
}

/** The calibration or region-set preview panel, whichever flow is mid-flight. */
export function ViewerPreviewPanels({ scale, tools, onOpenRow }: Props) {
  if (scale.preview) {
    return <CalibrationPreviewPanel preview={scale.preview} applying={scale.applying} onApply={scale.apply} onCancel={scale.clear} onOpenRow={onOpenRow} />;
  }
  if (tools.viewportImpact) {
    return <ViewportImpactPanel preview={tools.viewportImpact} applying={tools.savingViewport} onApply={tools.applyRegionSet} onCancel={tools.cancelRegionSet} onOpenRow={onOpenRow} />;
  }
  return <OverlayControls ovl={tools.ovl} />;
}
ViewerPreviewPanels.displayName = "ViewerPreviewPanels";

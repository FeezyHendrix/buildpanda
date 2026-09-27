import { useState } from "react";
import type { PreconSheet } from "@/api/precon";
import { editorApi, type CalibrationPreview } from "@/api/precon-editor";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { mmPerPtForRatio } from "@/lib/precon-meta";
import { newOperationId, useEditorOperation } from "@/hooks/use-precon-editor";

/**
 * A typed 1:N ratio through the same preview→apply contract as the drawn
 * reference — Sheet settings has no direct scale write left: figures are shown
 * before anything moves, and the apply is pinned to the preview's token.
 */
export function useRatioScale(sessionId: string, sheet: PreconSheet) {
  const [preview, setPreview] = useState<CalibrationPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useEditorOperation(sessionId);

  const runPreview = async (ratio: number) => {
    setPreviewing(true);
    setError(null);
    const mmPerPt = mmPerPtForRatio(ratio);
    try {
      // the sheet DTO carries `version`; a 409 is a genuine conflict, shown as-is
      setPreview(await editorApi.previewCalibration(sheet.id, { newScaleMmPerPt: mmPerPt, version: sheet.version ?? 1 }));
    } catch (previewError) {
      setError(getApiErrorMessage(previewError, "Could not preview the new scale."));
    } finally {
      setPreviewing(false);
    }
  };

  const apply = (onDone?: () => void) => {
    if (!preview) return;
    operation.mutate(
      {
        operationId: newOperationId(),
        expectedSheets: [{ id: sheet.id, version: preview.sheetVersion }],
        command: { kind: "apply-calibration", sheetId: sheet.id, mmPerPt: preview.newScaleMmPerPt, previewToken: preview.previewToken },
      },
      {
        onSuccess: () => {
          setPreview(null);
          onDone?.();
        },
        onError: (applyError) => {
          setPreview(null);
          setError(
            getApiErrorStatus(applyError) === 409
              ? `${getApiErrorMessage(applyError, "The drawing changed since the preview.")} Preview again to see the current figures.`
              : getApiErrorMessage(applyError, "Could not apply the scale."),
          );
        },
      },
    );
  };

  return { preview, previewing, error, applying: operation.isPending, runPreview, apply, clear: () => setPreview(null) };
}

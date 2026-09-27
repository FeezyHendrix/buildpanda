import { useRef, useState } from "react";
import type { PreconSheet } from "@/api/precon";
import { editorApi, type CalibrationPreview } from "@/api/precon-editor";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { newOperationId, useEditorOperation } from "@/hooks/use-precon-editor";

export type ScaleUnit = "mm" | "cm" | "m";

/** The drawn reference: two editable endpoints and the stated real distance. */
export interface ScalePrompt {
  fromPt: [number, number];
  toPt: [number, number];
  distance: string;
  unit: ScaleUnit;
}

const MM_PER_UNIT: Record<ScaleUnit, number> = { mm: 1, cm: 10, m: 1000 };

export function promptPtLength(prompt: ScalePrompt): number {
  return Math.hypot(prompt.toPt[0] - prompt.fromPt[0], prompt.toPt[1] - prompt.fromPt[1]);
}

export function promptMmPerPt(prompt: ScalePrompt): number | null {
  const distance = Number(prompt.distance);
  const ptLength = promptPtLength(prompt);
  if (!Number.isFinite(distance) || distance <= 0 || ptLength <= 0) return null;
  return (distance * MM_PER_UNIT[prompt.unit]) / ptLength;
}

/**
 * Contract-12 calibration: edit the reference (drag an endpoint, retype the
 * distance, pick the unit) → PREVIEW every line's before/after at the new
 * scale → APPLY through the operation envelope, pinned by the preview's token
 * and sheet version. A refused apply keeps the drawn reference and the typed
 * figures; a stale token demands an explicit re-preview, never a blind write.
 */
export function useScalePrompt({ sessionId, activeSheet, onApplied }: { sessionId: string; activeSheet: PreconSheet | null; onApplied: () => void }) {
  const [prompt, setPrompt] = useState<ScalePrompt | null>(null);
  const [preview, setPreview] = useState<CalibrationPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useEditorOperation(sessionId);
  const operationIdRef = useRef(newOperationId());

  const start = (fromPt: [number, number], toPt: [number, number]) => {
    setPrompt({ fromPt, toPt, distance: "", unit: "mm" });
    setPreview(null);
    setError(null);
    operationIdRef.current = newOperationId();
  };

  /** Any edit to the reference makes the shown figures stale: preview again. */
  const patch = (changes: Partial<ScalePrompt>) => {
    setPrompt((current) => (current ? { ...current, ...changes } : current));
    setPreview(null);
    setError(null);
  };

  const movePoint = (which: "from" | "to", pt: [number, number]) => patch(which === "from" ? { fromPt: pt } : { toPt: pt });

  const runPreview = async () => {
    if (!prompt || !activeSheet) return;
    const mmPerPt = promptMmPerPt(prompt);
    if (mmPerPt === null) return setError("Enter the real distance between the two points first.");
    setPreviewing(true);
    setError(null);
    try {
      // The sheet DTO carries `version` now; a genuine 409 is a real conflict
      // and surfaces to the user instead of being silently retried.
      const result = await editorApi.previewCalibration(activeSheet.id, { newScaleMmPerPt: mmPerPt, version: activeSheet.version ?? 1 });
      setPreview(result);
    } catch (previewError) {
      setError(getApiErrorMessage(previewError, "Could not preview the new scale."));
    } finally {
      setPreviewing(false);
    }
  };

  const apply = () => {
    if (!prompt || !preview || !activeSheet) return;
    const mmPerPt = promptMmPerPt(prompt);
    if (mmPerPt === null) return;
    operation.mutate(
      {
        operationId: operationIdRef.current,
        expectedSheets: [{ id: activeSheet.id, version: preview.sheetVersion }],
        command: {
          kind: "apply-calibration",
          sheetId: activeSheet.id,
          mmPerPt,
          reference: { fromPt: prompt.fromPt, toPt: prompt.toPt, enteredDistance: Number(prompt.distance), unit: prompt.unit },
          previewToken: preview.previewToken,
        },
      },
      {
        onSuccess: () => {
          setPrompt(null);
          setPreview(null);
          onApplied();
        },
        onError: (applyError) => {
          setPreview(null);
          setError(
            getApiErrorStatus(applyError) === 409
              ? `${getApiErrorMessage(applyError, "The drawing changed since the preview.")} Preview again to see the current figures.`
              : getApiErrorMessage(applyError, "Could not apply the scale — the drawn reference is kept."),
          );
        },
      },
    );
  };

  const clear = () => {
    setPrompt(null);
    setPreview(null);
    setError(null);
  };

  return { prompt, preview, previewing, error, applying: operation.isPending, start, patch, movePoint, runPreview, apply, clear };
}

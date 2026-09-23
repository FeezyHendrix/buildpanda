import { useEffect, useState } from "react";
import type { OverlayAnchorPair, PreconSheet } from "@/api/precon";
import { newOperationId, useEditorOperation } from "@/hooks/use-precon-editor";
import { usePreconSnapshot } from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { applyAffine, invertAffine, type Affine } from "./overlay-model";
import type { PreviousRevision } from "./use-previous-revision";

/** What the layers need to paint the persisted overlay (contract 23). */
export interface OverlayRenderModel {
  sheet: PreconSheet;
  sheets: PreconSheet[];
  /** Sheet-point-space source→target matrix; identity when unaligned. */
  matrix: Affine;
  opacity: number;
  visible: boolean;
}

interface Args {
  sessionId: string;
  activeSheet: PreconSheet | null;
  /** Banner + alignment only while the Overlay tool is on. */
  active: boolean;
  previous: PreviousRevision;
  setNote: (note: string | null) => void;
}

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

/**
 * The persisted revision-overlay suite: source choice, opacity, blink, the
 * three-anchor alignment capture and its `set-overlay` receipt. The overlay
 * is a view record on the sheet — it never touches a quantity — so every
 * change is one versioned envelope operation, refused (400) on collinear
 * anchors and shown as the server's own words.
 */
export function useOverlaySuite({ sessionId, activeSheet, active, previous, setNote }: Args) {
  const { data: snapshot } = usePreconSnapshot(sessionId);
  const operation = useEditorOperation(sessionId);
  const persisted = activeSheet?.overlaySettings ?? null;

  const [sourceSheetId, setSourceSheetId] = useState<string | null>(null);
  const [opacity, setOpacity] = useState<number | null>(null);
  const [blinkOn, setBlinkOn] = useState(false);
  const [blinkPhase, setBlinkPhase] = useState(true);
  const [aligning, setAligning] = useState(false);
  const [pairs, setPairs] = useState<OverlayAnchorPair[]>([]);
  const [pendingSource, setPendingSource] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!blinkOn) return setBlinkPhase(true);
    const t = window.setInterval(() => setBlinkPhase((v) => !v), 500);
    return () => window.clearInterval(t);
  }, [blinkOn]);

  // The tool closing drops any half-collected alignment, never the record.
  useEffect(() => {
    if (active) return;
    setAligning(false);
    setPairs([]);
    setPendingSource(null);
    setBlinkOn(false);
  }, [active]);

  const sessionSheets = snapshot?.sheets ?? [];
  const chosenSourceId = sourceSheetId ?? persisted?.sourceSheetId ?? (previous.status === "ready" ? previous.sheet?.id : null) ?? null;
  const sourceIsPrevious = previous.status === "ready" && previous.sheet?.id === chosenSourceId;
  const sourcePool = sourceIsPrevious ? previous.sheets : sessionSheets;
  const sourceSheet = chosenSourceId ? (sourcePool.find((s) => s.id === chosenSourceId) ?? null) : null;
  const effOpacity = opacity ?? persisted?.opacity ?? 0.4;
  const matrix: Affine = persisted && persisted.sourceSheetId === chosenSourceId ? persisted.matrix : IDENTITY;

  const render: OverlayRenderModel | null =
    sourceSheet && (persisted || active) ? { sheet: sourceSheet, sheets: sourcePool, matrix, opacity: effOpacity, visible: blinkPhase } : null;

  /** Odd clicks pick the feature on the ghost (source), even clicks the same feature on this sheet. */
  const captureClick = (pt: [number, number]): boolean => {
    if (!aligning || pairs.length >= 3) return false;
    if (!pendingSource) {
      setPendingSource(applyAffine(invertAffine(matrix), pt));
      return true;
    }
    setPairs((cur) => [...cur, { source: pendingSource, target: pt }]);
    setPendingSource(null);
    return true;
  };

  const send = (overlay: { sourceSheetId: string; opacity: number; anchors: OverlayAnchorPair[] } | null, done: string) => {
    if (!activeSheet) return;
    operation.mutate(
      {
        operationId: newOperationId(),
        expectedSheets: [{ id: activeSheet.id, version: activeSheet.version ?? 1 }],
        command: { kind: "set-overlay", sheetId: activeSheet.id, overlay },
      },
      {
        onSuccess: () => {
          setAligning(false);
          setPairs([]);
          setPendingSource(null);
          setNote(done);
        },
        onError: (error) => setNote(getApiErrorMessage(error, "The overlay change was refused.")),
      },
    );
  };

  return {
    active,
    render,
    persisted,
    saving: operation.isPending,
    sourceOptions: [
      ...(previous.status === "ready" && previous.sheet ? [{ id: previous.sheet.id, label: `${previous.sheet.code ?? previous.sheet.title ?? previous.sheet.fileName} (rev ${previous.revision ?? "prev"})` }] : []),
      ...sessionSheets.filter((s) => s.id !== activeSheet?.id).map((s) => ({ id: s.id, label: s.code ?? s.title ?? s.fileName })),
    ],
    chosenSourceId,
    setSourceSheetId,
    opacity: effOpacity,
    setOpacity,
    blinkOn,
    toggleBlink: () => setBlinkOn((v) => !v),
    aligning,
    pairs,
    pendingSource,
    startAlign: () => {
      setAligning(true);
      setPairs([]);
      setPendingSource(null);
    },
    cancelAlign: () => {
      setAligning(false);
      setPairs([]);
      setPendingSource(null);
    },
    captureClick,
    apply: () => {
      if (!chosenSourceId || pairs.length !== 3) return;
      send({ sourceSheetId: chosenSourceId, opacity: effOpacity, anchors: pairs }, "Overlay aligned and saved.");
    },
    applyOpacityOnly: () => {
      if (!persisted) return;
      send({ sourceSheetId: persisted.sourceSheetId, opacity: effOpacity, anchors: persisted.anchors }, "Overlay opacity saved.");
    },
    reset: () => send(null, "Overlay removed."),
  };
}

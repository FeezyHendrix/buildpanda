import { useEffect, useState } from "react";
import type { PreconSheet } from "@/api/precon";
import { useRoomAt, useSymbolMatches, useUpdateSheetViewports } from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { scaleRatioOf, type PreconTool } from "@/lib/precon-meta";
import { toast } from "@/lib/toast";
import { pathLengthPt } from "./measure-maths";
import type { PendingMeasurement } from "./measurement-composer";
import { keptPoints, symbolDescription, toggleMatch, type SymbolMatches } from "./symbol-matches-layer";
import { usePreviousRevision } from "./use-previous-revision";
import { newViewportDraft, viewportFromDraft, viewportScaleOf, type ViewportDraft } from "./viewport-prompt";

interface Args {
  sessionId: string;
  activeSheet: PreconSheet | null;
  onToolChange: (tool: PreconTool) => void;
  /** The shape on the sheet: a found room or the kept matches replace it; a saved viewport clears it. */
  draft: { replace: (vertices: number[][]) => void; clear: () => void };
  setPending: (pending: PendingMeasurement | null) => void;
  setNote: (note: string | null) => void;
}

function httpStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

/**
 * The M2 tools that talk to the sheet's geometry or its settings: Room fill,
 * Find symbol, Viewport and Overlay. Each ends in the same place as a hand
 * drawn shape — a pending measurement for the composer — or in a sheet update.
 */
export function useViewerTools({ sessionId, activeSheet, onToolChange, draft, setPending, setNote }: Args) {
  const sheetId = activeSheet?.id ?? null;
  const [viewportDraft, setViewportDraft] = useState<ViewportDraft | null>(null);
  const [matches, setMatches] = useState<SymbolMatches | null>(null);
  const [overlayOn, setOverlayOn] = useState(false);
  const roomAt = useRoomAt(sheetId);
  const symbolMatches = useSymbolMatches(sheetId);
  const updateViewports = useUpdateSheetViewports(sessionId);
  const previous = usePreviousRevision(sessionId, activeSheet, overlayOn);

  // The overlay says so when there is nothing to show, then switches itself off.
  useEffect(() => {
    if (!overlayOn || previous.status !== "none") return;
    setNote("This drawing has no previous revision to overlay.");
    setOverlayOn(false);
  }, [overlayOn, previous.status, setNote]);

  const reset = () => {
    setViewportDraft(null);
    setMatches(null);
  };

  const roomFillAt = (pt: [number, number]) => {
    if (!sheetId) return;
    roomAt.mutate(
      { x: pt[0], y: pt[1] },
      {
        onSuccess: (room) => {
          draft.replace(room.vertices);
          setPending({ tool: "area", vertices: room.vertices, description: room.label ?? "" });
        },
        onError: (error) =>
          setNote(httpStatus(error) === 404 ? "No enclosed space here — draw it with Area (A)." : getApiErrorMessage(error, "Could not find the space")),
      },
    );
  };

  const findSymbolIn = (rect: [number, number, number, number]) => {
    if (!sheetId) return;
    symbolMatches.mutate(rect, {
      onSuccess: (result) => {
        if (result.points.length === 0) {
          setNote("No symbol found in that box — drag tighter round one symbol.");
          return;
        }
        setMatches({ name: result.name, points: result.points, dropped: new Set() });
      },
      onError: (error) => setNote(getApiErrorMessage(error, "Could not search the sheet")),
    });
  };
  const onToggleMatch = (index: number) => setMatches((current) => (current ? toggleMatch(current, index) : current));
  const confirmMatches = () => {
    if (!matches) return;
    const kept = keptPoints(matches);
    if (kept.length === 0) return;
    draft.replace(kept);
    setPending({ tool: "count", vertices: kept, description: symbolDescription(matches) });
    setMatches(null);
  };

  const startViewport = (rect: [number, number, number, number]) => setViewportDraft(newViewportDraft(rect, activeSheet?.viewports?.length ?? 0));
  const patchViewport = (patch: Partial<ViewportDraft>) => setViewportDraft((current) => (current ? { ...current, ...patch } : current));
  /** Two calibration clicks inside the viewport are down: remember their distance, ask for the real one. */
  const calibrateViewport = (vertices: number[][]) => {
    if (vertices.length >= 2) patchViewport({ ptLength: pathLengthPt(vertices.slice(0, 2)) });
  };
  const saveViewport = () => {
    if (!viewportDraft || !activeSheet) return;
    const scale = viewportScaleOf(viewportDraft);
    if (scale === null) return;
    const viewport = viewportFromDraft(viewportDraft, scale);
    updateViewports.mutate(
      { sheetId: activeSheet.id, viewports: [...(activeSheet.viewports ?? []), viewport] },
      {
        onSuccess: () => {
          toast(`Viewport ${viewport.label} saved at 1:${scaleRatioOf(scale)}. Lines drawn inside it use that scale.`, "success");
          setViewportDraft(null);
          draft.clear();
          onToolChange("select");
        },
        onError: (error) => toast(getApiErrorMessage(error, "Could not save the viewport."), "error"),
      },
    );
  };
  const removeViewport = (viewportId: string) => {
    if (!activeSheet) return;
    updateViewports.mutate(
      { sheetId: activeSheet.id, viewports: (activeSheet.viewports ?? []).filter((v) => v.id !== viewportId) },
      { onError: (error) => toast(getApiErrorMessage(error, "Could not remove the viewport."), "error") },
    );
  };

  const toggleOverlay = () => {
    setNote(null);
    setOverlayOn((on) => !on);
  };

  return {
    viewportDraft,
    matches,
    overlayOn,
    previous,
    searching: roomAt.isPending || symbolMatches.isPending,
    savingViewport: updateViewports.isPending,
    reset,
    roomFillAt,
    findSymbolIn,
    onToggleMatch,
    confirmMatches,
    startViewport,
    patchViewport,
    calibrateViewport,
    saveViewport,
    removeViewport,
    toggleOverlay,
  };
}

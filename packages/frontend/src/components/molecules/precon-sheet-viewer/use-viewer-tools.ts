import { useEffect, useState } from "react";
import type { PreconGeometry, PreconSheet } from "@/api/precon";
import { editorApi, type SheetViewportInput, type ViewportPreview } from "@/api/precon-editor";
import { newOperationId, useEditorOperation } from "@/hooks/use-precon-editor";
import { getApiErrorMessage } from "@/lib/api-error";
import type { PreconTool } from "@/lib/precon-meta";
import { toast } from "@/lib/toast";
import { pathLengthPt } from "./measure-maths";
import type { PendingMeasurement } from "./measurement-composer";
import { useDetectionTools } from "./use-detection-tools";
import { usePreviousRevision } from "./use-previous-revision";
import { useOverlaySuite } from "./use-overlay-suite";
import { newViewportDraft, viewportFromDraft, viewportScaleOf, type ViewportDraft } from "./viewport-prompt";
import type { RegionEdit } from "./viewport-edit-layer";
import { DEFAULT_PEN_STYLE, type PenStyle } from "./pen-presets";
import { mmPerPtForRatio, scaleRatioOf } from "@/lib/precon-meta";

interface Args {
  sessionId: string;
  activeSheet: PreconSheet | null;
  tool: PreconTool;
  onToolChange: (tool: PreconTool) => void;
  /** The shape on the sheet: a saved viewport clears it. */
  draft: { replace: (vertices: number[][]) => void; clear: () => void };
  /** All saved geometries; this sheet's count markers are Find symbol's duplicate baseline. */
  geometries: PreconGeometry[];
  setPending: (pending: PendingMeasurement | null) => void;
  setNote: (note: string | null) => void;
}

/**
 * The M2 tools that talk to the sheet's geometry or its settings: Room fill
 * and Find symbol (correctable review flows in `useDetectionTools`), Viewport
 * and Overlay. Each ends in the same place as a hand-drawn shape — a pending
 * measurement for the composer — or in a sheet update.
 */
export function useViewerTools({ sessionId, activeSheet, tool, onToolChange, draft, geometries, setPending, setNote }: Args) {
  const existingCountPoints = geometries.flatMap((g) => (g.sheetId === activeSheet?.id && g.kind === "count" ? g.vertices : []));
  const [viewportDraft, setViewportDraft] = useState<ViewportDraft | null>(null);
  const [viewportImpact, setViewportImpact] = useState<{ preview: ViewportPreview; next: SheetViewportInput[] } | null>(null);
  const [regionEdit, setRegionEdit] = useState<RegionEdit | null>(null);
  const [viewportBusy, setViewportBusy] = useState(false);
  const [overlayOn, setOverlayOn] = useState(false);
  const [penStyle, setPenStyle] = useState<PenStyle>(DEFAULT_PEN_STYLE);
  const operation = useEditorOperation(sessionId);
  const previous = usePreviousRevision(sessionId, activeSheet, overlayOn);
  const ovl = useOverlaySuite({ sessionId, activeSheet, active: overlayOn, previous, setNote });
  const overlayHasSources = ovl.sourceOptions.length > 0 || ovl.persisted !== null;
  const detect = useDetectionTools({
    activeSheet,
    tool,
    existingCountPoints,
    setPending,
    setNote,
    onFallbackToArea: () => onToolChange("area"),
  });

  // The overlay says so when there is nothing at all to show, then switches
  // itself off. Same-session sheets and a persisted alignment both count as
  // something to show (contract 23), not just a plan-chain previous revision.
  useEffect(() => {
    if (!overlayOn || previous.status !== "none" || overlayHasSources) return;
    setNote("This drawing has no previous revision to overlay.");
    setOverlayOn(false);
  }, [overlayOn, previous.status, overlayHasSources, setNote]);

  const reset = () => {
    setViewportDraft(null);
    setViewportImpact(null);
    setRegionEdit(null);
    detect.reset();
  };

  // Contract 12: the region set goes through viewport-preview, then the
  // apply-viewports operation pinned to the preview's token and sheet
  // version — read straight off the sheet DTO. A 409 is a genuine conflict.
  const previewRegionSet = async (next: SheetViewportInput[]) => {
    if (!activeSheet) return;
    setViewportBusy(true);
    try {
      const preview = await editorApi.previewViewports(activeSheet.id, { viewports: next, version: activeSheet.version ?? 1 });
      setViewportImpact({ preview, next });
    } catch (error) {
      setNote(getApiErrorMessage(error, "Could not preview the region change."));
    } finally {
      setViewportBusy(false);
    }
  };

  const applyRegionSet = (confirmed: boolean) => {
    if (!viewportImpact || !activeSheet) return;
    operation.mutate(
      {
        operationId: newOperationId(),
        expectedSheets: [{ id: activeSheet.id, version: viewportImpact.preview.sheetVersion }],
        command: {
          kind: "apply-viewports",
          sheetId: activeSheet.id,
          viewports: viewportImpact.next,
          previewToken: viewportImpact.preview.previewToken,
          ...(confirmed ? { confirmed: true } : {}),
        },
      },
      {
        onSuccess: () => {
          toast("Scale regions updated. Lines measured in a changed region were restated.", "success");
          setViewportImpact(null);
          setViewportDraft(null);
          draft.clear();
          onToolChange("select");
        },
        onError: (error) => setNote(getApiErrorMessage(error, "Could not apply the region change — the preview is kept.")),
      },
    );
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
    void previewRegionSet([...(activeSheet.viewports ?? []), viewport]);
  };
  const removeViewport = (viewportId: string) => {
    if (!activeSheet) return;
    void previewRegionSet((activeSheet.viewports ?? []).filter((v) => v.id !== viewportId));
  };
  const startRegionEdit = (viewportId: string) => {
    const region = (activeSheet?.viewports ?? []).find((v) => v.id === viewportId);
    if (!region) return;
    setRegionEdit({ id: region.id, label: region.label, ratio: String(scaleRatioOf(region.scaleMmPerPt)), rect: [...region.rect] as [number, number, number, number] });
  };
  const patchRegionEdit = (changes: Partial<RegionEdit>) => setRegionEdit((current) => (current ? { ...current, ...changes } : current));
  const saveRegionEdit = () => {
    if (!regionEdit || !activeSheet) return;
    const ratio = Number(regionEdit.ratio);
    if (!Number.isFinite(ratio) || ratio <= 0) return setNote("The region scale must be a positive ratio, e.g. 20 for 1:20.");
    const next = (activeSheet.viewports ?? []).map((v) =>
      v.id === regionEdit.id ? { id: v.id, label: regionEdit.label.trim() || v.label, rect: regionEdit.rect, scaleMmPerPt: mmPerPtForRatio(ratio) } : v,
    );
    setRegionEdit(null);
    void previewRegionSet(next);
  };

  const toggleOverlay = () => {
    setNote(null);
    setOverlayOn((on) => !on);
  };

  return {
    viewportDraft,
    regionEdit,
    startRegionEdit,
    patchRegionEdit,
    saveRegionEdit,
    cancelRegionEdit: () => setRegionEdit(null),
    penStyle,
    setPenStyle,
    ovl,
    viewportImpact: viewportImpact?.preview ?? null,
    applyRegionSet,
    cancelRegionSet: () => setViewportImpact(null),
    detect,
    detectionActive: Boolean(detect.room || detect.template || detect.review || detect.noRoomFound),
    overlayOn,
    previous,
    searching: detect.searching,
    savingViewport: viewportBusy || operation.isPending,
    reset,
    roomFillAt: detect.roomFillAt,
    findSymbolIn: detect.startTemplate,
    startViewport,
    patchViewport,
    calibrateViewport,
    saveViewport,
    removeViewport,
    toggleOverlay,
  };
}

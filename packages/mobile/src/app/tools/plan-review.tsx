import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { DEFAULT_ASPECT } from "@/components/plan-review/canvas-support";
import { CommentComposer } from "@/components/plan-review/comment-composer";
import { MarkupPanel } from "@/components/plan-review/markup-panel";
import {
  ALL_LAYERS_VISIBLE,
  DEFAULT_MARKUP_COLOR,
  MARKUP_KIND,
  SHEET_TOOL,
  type MarkupGeometry,
  type MarkupPoint,
  type SheetMarkup,
  type SheetRenderInfo,
  type SheetLayer,
  type SheetTool,
} from "@/components/plan-review/markup-types";
import { PendingSyncPill, SheetControls, SheetPager, ToolHint, ZoomReadout } from "@/components/plan-review/sheet-controls";
import SheetCanvas from "@/components/plan-review/sheet-canvas.dom";
import { ScalePrompt, type ScalePromptStage } from "@/components/plan-review/sheet-scale-prompt";
import { SheetStrip } from "@/components/plan-review/sheet-strip";
import { TabletMinWidth } from "@/constants/theme";
import type { Db } from "@/db/client";
import { DOCUMENT_GROUP } from "@/db/documents-repository";
import { useLocalDb } from "@/db/provider";
import { drawingMarkupsRepository } from "@/db/drawing-markups-repository";
import { flushOutbox } from "@/db/outbox";
import { useLocalDocuments } from "@/hooks/use-local-documents";
import { useMarkupActions } from "@/hooks/use-markup-actions";
import { useMarkupUndo } from "@/hooks/use-markup-undo";
import { usePageMarkups } from "@/hooks/use-page-markups";
import { useSheetScale } from "@/hooks/use-sheet-scale";
import { useSheetSource } from "@/hooks/use-sheet-source";
import { useFieldSession } from "@/lib/field-session";
import { useProjectAssignees } from "@/hooks/use-participants";
import { sheetLabel } from "@/components/plan-review/sheet-strip";

export default function PlanReview() {
  const { projectId, userId } = useFieldSession();
  const { db, ready } = useLocalDb();

  if (!db || !ready || !projectId) {
    return (
      <Page title="Plan review" onBack={() => router.back()} scroll={false}>
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      </Page>
    );
  }
  return <ReviewScreen db={db} projectId={projectId} userId={userId} />;
}

function ReviewScreen({ db, projectId, userId }: { db: Db; projectId: string; userId: string | undefined }) {
  const { documentId } = useLocalSearchParams<{ documentId?: string }>();
  const plans = useLocalDocuments(db, projectId, DOCUMENT_GROUP.PLAN);
  const { width, height } = useWindowDimensions();
  const sidePanel = width > height && width >= TabletMinWidth;

  const sheets = useMemo(() => plans.data.filter((doc) => doc.currentVersionId), [plans.data]);

  const [activeDocId, setActiveDocId] = useState<string | undefined>(documentId);
  const activeSheet = useMemo(() => sheets.find((s) => s.id === activeDocId) ?? sheets[0], [sheets, activeDocId]);

  const [pageNo, setPageNo] = useState(1);
  const [tool, setTool] = useState<SheetTool>(SHEET_TOOL.PAN);
  const [color, setColor] = useState<string>(DEFAULT_MARKUP_COLOR);
  const [layers, setLayers] = useState(ALL_LAYERS_VISIBLE);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<MarkupPoint | null>(null);
  const [renderInfo, setRenderInfo] = useState<SheetRenderInfo | null>(null);
  const [zoomPct, setZoomPct] = useState(100);
  const [fitNonce, setFitNonce] = useState(0);
  const [calibrating, setCalibrating] = useState<ScalePromptStage | null>(null);
  const [calibrationLine, setCalibrationLine] = useState<{ a: MarkupPoint; b: MarkupPoint } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sheetId = activeSheet?.id;
  const versionId = activeSheet?.currentVersionId ?? null;
  const fileName = activeSheet?.fileName ?? "";
  const assignees = useProjectAssignees(projectId);
  const aspect = renderInfo?.aspect ?? DEFAULT_ASPECT;

  const { source } = useSheetSource(db, projectId, sheetId, fileName, setError);
  const { markups, readLocal, reset: resetMarkups } = usePageMarkups(db, projectId, sheetId, versionId, pageNo);
  const undo = useMarkupUndo(db, projectId, versionId ? `${versionId}:${pageNo}` : null);
  const sheetScale = useSheetScale(userId, versionId);
  const metresPerPct = sheetScale.scale?.metresPerPct ?? null;

  const actions = useMarkupActions({
    db,
    projectId,
    sheetId,
    versionId,
    sheetCode: activeSheet ? sheetLabel(activeSheet).code : fileName,
    pageNo,
    onChanged: () => readLocal(),
    onError: setError,
  });


  const pendingCount = useMemo(
    () =>
      markups.filter((m) => (m as { isPendingSync?: boolean }).isPendingSync).length +
      markups.reduce((n, m) => n + m.comments.filter((c) => (c as { isPendingSync?: boolean }).isPendingSync).length, 0),
    [markups],
  );

  const layerCounts = useMemo(
    () => ({
      ink: markups.filter((m) => m.kind === MARKUP_KIND.PEN || m.kind === MARKUP_KIND.CLOUD).length,
      comments: markups.filter((m) => m.kind === MARKUP_KIND.PIN).length,
    }),
    [markups],
  );

  const canvasMarkups = useMemo<SheetMarkup[]>(
    () =>
      markups
        .filter((m) => {
          if (m.kind === MARKUP_KIND.PIN) return layers.comments;
          if (m.kind === MARKUP_KIND.PEN || m.kind === MARKUP_KIND.CLOUD) return layers.ink;
          return true;
        })
        .map((m) => ({ id: m.id, kind: m.kind, geometry: m.geometry, color: m.color, resolved: Boolean(m.resolvedAt) })),
    [markups, layers],
  );

  const selected = useMemo(() => markups.find((m) => m.id === selectedId) ?? null, [markups, selectedId]);

  function clearTransient() {
    setSelectedId(null);
    setPendingAnchor(null);
    setCalibrating(null);
    setCalibrationLine(null);
  }

  function switchSheet(id: string) {
    setActiveDocId(id);
    setPageNo(1);
    clearTransient();
    resetMarkups();
    setError(null);
    // the page count belongs to the sheet that is going away
    setRenderInfo(null);
  }

  async function persistMarkup(geometry: MarkupGeometry) {
    if (!sheetId || !versionId) return;
    setError(null);
    try {
      const id = await drawingMarkupsRepository.createLocal(db, {
        projectId,
        documentId: sheetId,
        documentVersionId: versionId,
        pageNo,
        kind: geometry.kind,
        geometry: { ...geometry, space: "percent" },
        color,
      });
      undo.push({ id, kind: geometry.kind, geometry });
      await readLocal();
      if (calibrating === "draw" && geometry.kind === MARKUP_KIND.MEASURE) {
        // the line is a real measure too; it reads its length once the scale is in
        setCalibrationLine({ a: geometry.a, b: geometry.b });
        setCalibrating("enter");
      } else {
        setSelectedId(id);
      }
      // push now when there is signal; the outbox keeps it when there is not
      void flushOutbox(db).then(readLocal);
    } catch (err) {
      console.error("markup create failed", err);
      setError(err instanceof Error && err.message ? err.message : "Couldn't save that markup.");
    }
  }

  async function undoLast() {
    try {
      if (!(await undo.undo(markups))) return;
      setSelectedId(null);
      await readLocal();
      void flushOutbox(db).then(readLocal);
    } catch (err) {
      console.error("markup undo failed", err);
      setError(err instanceof Error && err.message ? err.message : "Couldn't undo that markup.");
    }
  }

  function startSetScale() {
    setTool(SHEET_TOOL.MEASURE);
    setSelectedId(null);
    setPendingAnchor(null);
    setCalibrationLine(null);
    setCalibrating("draw");
  }

  function saveScale(metres: number) {
    if (!calibrationLine) return;
    if (!sheetScale.setFromLine(calibrationLine.a, calibrationLine.b, aspect, metres)) {
      setError("That line is too short to set a scale from. Draw a longer one.");
      return;
    }
    setCalibrating(null);
    setCalibrationLine(null);
  }

  const scaleLabel = metresPerPct ? "scale set" : null;

  if (sheets.length === 0) {
    return (
      <Page title="Plan review" onBack={() => router.back()} scroll={false}>
        <View className="items-center py-12">
          {plans.isPending ? (
            <Spinner size="md" />
          ) : (
            <>
              <Text weight="semibold" className="text-center text-base">
                No plans to review
              </Text>
              <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
                Drawings uploaded to this project will appear here.
              </Text>
            </>
          )}
        </View>
      </Page>
    );
  }

  const sidebar = calibrating ? (
    <ScalePrompt stage={calibrating} onCancel={() => setCalibrating(null)} onSave={saveScale} />
  ) : pendingAnchor ? (
    <CommentComposer
      assignees={assignees}
      busy={actions.busy}
      onCancel={() => setPendingAnchor(null)}
      onSubmit={(draft) => {
        if (!pendingAnchor) return;
        const at = pendingAnchor;
        void actions.submitComment({ ...draft, color }, at, (id) => {
          undo.push({ id, kind: MARKUP_KIND.PIN, geometry: { kind: MARKUP_KIND.PIN, at } });
          setPendingAnchor(null);
          setSelectedId(id);
        });
      }}
    />
  ) : selected ? (
    <MarkupPanel
      markup={selected}
      busy={actions.busy}
      onAddComment={(body) => void actions.addComment(selected, body)}
      onResolve={(resolved) => void actions.setResolved(selected, resolved)}
      onDelete={() => void actions.remove(selected, () => setSelectedId(null))}
      onClose={() => setSelectedId(null)}
      onError={setError}
    />
  ) : (
    <ToolHint tool={tool} scaleLabel={scaleLabel} onSetScale={startSetScale} />
  );

  return (
    <Page title={fileName || "Plan review"} onBack={() => router.back()} scroll={false} className="px-0 pb-0 pt-0">
      <View className="flex-1">
        <SheetStrip sheets={sheets} activeId={activeSheet?.id} onSelect={switchSheet} />

        {error ? (
          <View className="bg-error-50 px-4 py-2">
            <Text tone="danger" className="text-xs">
              {error}
            </Text>
          </View>
        ) : null}

        <View className={sidePanel ? "flex-1 flex-row" : "flex-1"}>
          <View className="flex-1 bg-grey-50">
            {source && versionId ? (
              <SheetCanvas
                dom={{ style: { flex: 1 } }}
                docKey={`${versionId}`}
                pdfBase64={source.pdfBase64}
                imageDataUri={source.imageDataUri}
                pageNo={pageNo}
                markups={canvasMarkups}
                selectedId={selectedId}
                tool={tool}
                color={color}
                metresPerPct={metresPerPct}
                fitNonce={fitNonce}
                draftPin={pendingAnchor}
                onCreate={persistMarkup}
                onTapPoint={async (pt) => {
                  setPendingAnchor(pt);
                  setSelectedId(null);
                }}
                onSelect={async (id) => setSelectedId(id)}
                onRendered={async (info) => setRenderInfo(info)}
                onZoom={async (pct) => setZoomPct(pct)}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Spinner size="md" />
                <Text tone="secondary" className="pt-3 text-[13px]">
                  Preparing sheet…
                </Text>
              </View>
            )}
            <PendingSyncPill count={pendingCount} />
            <SheetControls
              tool={tool}
              onSelectTool={(next) => {
                setTool(next);
                if (next !== SHEET_TOOL.MEASURE) setCalibrating(null);
              }}
              color={color}
              onSelectColor={setColor}
              canUndo={undo.canUndo}
              onUndo={() => void undoLast()}
              onFit={() => setFitNonce((n) => n + 1)}
              layers={layers}
              counts={layerCounts}
              onToggleLayer={(layer: SheetLayer) => setLayers((current) => ({ ...current, [layer]: !current[layer] }))}
              open={controlsOpen}
              onToggleOpen={() => setControlsOpen((v) => !v)}
            />
            <ZoomReadout pct={zoomPct} onFit={() => setFitNonce((n) => n + 1)} />
            <SheetPager
              pageNo={pageNo}
              pageCount={renderInfo?.pageCount ?? 1}
              onChangePage={(next) => {
                setPageNo(next);
                clearTransient();
              }}
            />
          </View>
          {sidePanel ? <View className="w-96 border-l border-hairline bg-surface">{sidebar}</View> : null}
        </View>

        {!sidePanel ? sidebar : null}
      </View>
    </Page>
  );
}

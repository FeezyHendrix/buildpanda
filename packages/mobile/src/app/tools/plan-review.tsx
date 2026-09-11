import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { drawingMarkupApi, type DrawingMarkup } from "@/api/drawing-markup";
import { participantsApi, toAssignees, type CommentAssignee } from "@/api/participants";
import { Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { CommentComposer } from "@/components/plan-review/comment-composer";
import { MarkupPanel } from "@/components/plan-review/markup-panel";
import {
  ALL_LAYERS_VISIBLE,
  MARKUP_KIND,
  SHEET_TOOL,
  type MarkupGeometry,
  type MarkupPoint,
  type SheetMarkup,
  type SheetRenderInfo,
  type SheetLayer,
  type SheetTool,
} from "@/components/plan-review/markup-types";
import { PendingSyncPill, SheetControls, SheetPager, ToolHint } from "@/components/plan-review/sheet-controls";
import SheetCanvas from "@/components/plan-review/sheet-canvas.dom";
import { SheetStrip } from "@/components/plan-review/sheet-strip";
import { TabletMinWidth } from "@/constants/theme";
import type { Db } from "@/db/client";
import { DOCUMENT_GROUP } from "@/db/documents-repository";
import { useLocalDb } from "@/db/provider";
import { drawingMarkupsRepository } from "@/db/drawing-markups-repository";
import { flushOutbox } from "@/db/outbox";
import { useLocalDocuments } from "@/hooks/use-local-documents";
import { useFieldSession } from "@/lib/field-session";
import { useSheetSource } from "@/hooks/use-sheet-source";
import { useMarkupActions } from "@/hooks/use-markup-actions";


export default function PlanReview() {
  const { projectId } = useFieldSession();
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
  return <ReviewScreen db={db} projectId={projectId} />;
}

function ReviewScreen({ db, projectId }: { db: Db; projectId: string }) {
  const { documentId } = useLocalSearchParams<{ documentId?: string }>();
  const plans = useLocalDocuments(db, projectId, DOCUMENT_GROUP.PLAN);
  const { width, height } = useWindowDimensions();
  const sidePanel = width > height && width >= TabletMinWidth;

  const sheets = useMemo(
    () => plans.data.filter((doc) => doc.currentVersionId),
    [plans.data],
  );

  const [activeDocId, setActiveDocId] = useState<string | undefined>(documentId);
  const activeSheet = useMemo(
    () => sheets.find((s) => s.id === activeDocId) ?? sheets[0],
    [sheets, activeDocId],
  );

  const [pageNo, setPageNo] = useState(1);
  const [tool, setTool] = useState<SheetTool>(SHEET_TOOL.PAN);
  const [layers, setLayers] = useState(ALL_LAYERS_VISIBLE);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<MarkupPoint | null>(null);
  const [markups, setMarkups] = useState<DrawingMarkup[]>([]);
  const [assignees, setAssignees] = useState<CommentAssignee[]>([]);
  const [renderInfo, setRenderInfo] = useState<SheetRenderInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sheetId = activeSheet?.id;
  const versionId = activeSheet?.currentVersionId ?? null;
  const fileName = activeSheet?.fileName ?? "";

  const { source } = useSheetSource(db, projectId, sheetId, fileName, setError);

  const actions = useMarkupActions({
    db,
    projectId,
    sheetId,
    versionId,
    pageNo,
    onChanged: () => readLocal(),
    onError: setError,
  });

  const readLocal = useCallback(async () => {
    if (!versionId) return;
    setMarkups(await drawingMarkupsRepository.pageWithComments(db, versionId, pageNo));
  }, [db, versionId, pageNo]);

  // Local first, so a sheet marked up in a basement still shows its markups.
  // The server's copy refreshes what is not still queued; losing signal here is
  // not an error, it is the normal case this app is built for.
  useEffect(() => {
    if (!versionId || !sheetId) return;
    let cancelled = false;
    void readLocal();
    drawingMarkupApi
      .listForVersion(projectId, versionId, pageNo)
      .then(async (rows) => {
        if (cancelled) return;
        await drawingMarkupsRepository.replacePage(
          db,
          versionId,
          pageNo,
          rows.map((r) => ({
            id: r.id,
            projectId,
            documentId: r.documentId,
            documentVersionId: r.documentVersionId,
            pageNo: r.pageNo,
            kind: r.kind,
            geometry: r.geometry,
            color: r.color,
            resolvedAt: r.resolvedAt,
            comments: r.comments,
          })),
        );
        if (!cancelled) await readLocal();
      })
      .catch((err: unknown) => console.warn("markup refresh deferred, working from the local copy", err));
    return () => {
      cancelled = true;
    };
  }, [db, projectId, versionId, sheetId, pageNo, readLocal]);

  useEffect(() => {
    let cancelled = false;
    participantsApi
      .list(projectId)
      .then((rows) => {
        if (!cancelled) setAssignees(toAssignees(rows));
      })
      .catch((err: unknown) => console.error("participants load failed", err));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const pendingCount = useMemo(
    () =>
      markups.filter((m) => (m as { isPendingSync?: boolean }).isPendingSync).length +
      markups.reduce((n, m) => n + m.comments.filter((c) => (c as { isPendingSync?: boolean }).isPendingSync).length, 0),
    [markups],
  );

  const layerCounts = useMemo(
    () => ({
      ink: markups.filter((m) => m.kind === MARKUP_KIND.PEN).length,
      comments: markups.filter((m) => m.kind === MARKUP_KIND.PIN).length,
    }),
    [markups],
  );

  const canvasMarkups = useMemo<SheetMarkup[]>(
    () =>
      markups
        .filter((m) => (m.kind === MARKUP_KIND.PEN ? layers.ink : m.kind === MARKUP_KIND.PIN ? layers.comments : true))
        .map((m) => ({
        id: m.id,
        kind: m.kind,
        geometry: m.geometry,
        color: m.color,
        resolved: Boolean(m.resolvedAt),
      })),
    [markups, layers],
  );

  const selected = useMemo(
    () => markups.find((m) => m.id === selectedId) ?? null,
    [markups, selectedId],
  );

  function switchSheet(id: string) {
    setActiveDocId(id);
    setPageNo(1);
    setSelectedId(null);
    setPendingAnchor(null);
    setMarkups([]);
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
      });
      await readLocal();
      setSelectedId(id);
      // push now when there is signal; the outbox keeps it when there is not
      void flushOutbox(db).then(readLocal);
    } catch (err) {
      console.error("markup create failed", err);
      setError(err instanceof Error && err.message ? err.message : "Couldn't save that markup.");
    }
  }

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

  const sidebar = pendingAnchor ? (
    <CommentComposer
      assignees={assignees}
      busy={actions.busy}
      onCancel={() => setPendingAnchor(null)}
      onSubmit={(draft) => { if (pendingAnchor) void actions.submitComment(draft, pendingAnchor, (id) => { setPendingAnchor(null); setSelectedId(id); }); }}
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
    <ToolHint tool={tool} />
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
                draftPin={pendingAnchor}
                onCreate={persistMarkup}
                onTapPoint={async (pt) => {
                  setPendingAnchor(pt);
                  setSelectedId(null);
                }}
                onSelect={async (id) => setSelectedId(id)}
                onRendered={async (info) => setRenderInfo(info)}
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
              onSelectTool={setTool}
              layers={layers}
              counts={layerCounts}
              onToggleLayer={(layer: SheetLayer) => setLayers((current) => ({ ...current, [layer]: !current[layer] }))}
              open={controlsOpen}
              onToggleOpen={() => setControlsOpen((v) => !v)}
            />
            <SheetPager
              pageNo={pageNo}
              pageCount={renderInfo?.pageCount ?? 1}
              onChangePage={(next) => {
                setPageNo(next);
                setSelectedId(null);
                setPendingAnchor(null);
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

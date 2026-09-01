import { router, useLocalSearchParams } from "expo-router";
import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import { useEffect, useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { drawingMarkupApi, type DrawingMarkup } from "@/api/drawing-markup";
import { uploadProjectFile } from "@/api/files";
import { participantsApi, toAssignees, type CommentAssignee } from "@/api/participants";
import { Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { CommentComposer } from "@/components/plan-review/comment-composer";
import { MarkupPanel } from "@/components/plan-review/markup-panel";
import {
  MARKUP_KIND,
  MEDIA_KIND,
  SHEET_TOOL,
  type CommentDraft,
  type MarkupGeometry,
  type MarkupPoint,
  type SheetMarkup,
  type SheetRenderInfo,
  type SheetTool,
} from "@/components/plan-review/markup-types";
import { ReviewToolbar, ToolHint } from "@/components/plan-review/review-toolbar";
import SheetCanvas from "@/components/plan-review/sheet-canvas.dom";
import { SheetStrip } from "@/components/plan-review/sheet-strip";
import { TabletMinWidth } from "@/constants/theme";
import type { Db } from "@/db/client";
import { DOCUMENT_GROUP } from "@/db/documents-repository";
import { useLocalDb } from "@/db/provider";
import { useLocalDocuments } from "@/hooks/use-local-documents";
import { cacheDocument } from "@/lib/download-file";
import { useFieldSession } from "@/lib/field-session";

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

const VOICE_NOTE_FILE = { name: "voice-note.m4a", mime: "audio/m4a" } as const;
const VIDEO_NOTE_FILE = { name: "site-video.mov", mime: "video/quicktime" } as const;

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

interface SheetSource {
  pdfBase64: string | null;
  imageDataUri: string | null;
}

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<MarkupPoint | null>(null);
  const [markups, setMarkups] = useState<DrawingMarkup[]>([]);
  const [assignees, setAssignees] = useState<CommentAssignee[]>([]);
  const [source, setSource] = useState<SheetSource | null>(null);
  const [renderInfo, setRenderInfo] = useState<SheetRenderInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sheetId = activeSheet?.id;
  const versionId = activeSheet?.currentVersionId ?? null;
  const fileName = activeSheet?.fileName ?? "";

  useEffect(() => {
    if (!sheetId || !fileName) return;
    let cancelled = false;
    setSource(null);
    setRenderInfo(null);
    (async () => {
      const uri = await cacheDocument(db, projectId, sheetId);
      if (!uri || cancelled) return;
      const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
      if (cancelled) return;
      const mime = IMAGE_MIME[extensionOf(fileName)];
      setSource(
        mime
          ? { pdfBase64: null, imageDataUri: `data:${mime};base64,${base64}` }
          : { pdfBase64: base64, imageDataUri: null },
      );
    })().catch((err: unknown) => {
      if (cancelled) return;
      console.error("plan review sheet load failed", err);
      setError(
        err instanceof Error && err.message
          ? `Couldn't load this sheet: ${err.message}`
          : "Couldn't load this sheet. Try again when you have signal.",
      );
    });
    return () => {
      cancelled = true;
    };
  }, [db, projectId, sheetId, fileName]);

  useEffect(() => {
    if (!versionId) return;
    let cancelled = false;
    drawingMarkupApi
      .listForVersion(projectId, versionId, pageNo)
      .then((rows) => {
        if (!cancelled) setMarkups(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("markup list failed", err);
        setError("Couldn't load markups. Review needs a connection.");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, versionId, pageNo]);

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

  const canvasMarkups = useMemo<SheetMarkup[]>(
    () =>
      markups.map((m) => ({
        id: m.id,
        kind: m.kind,
        geometry: m.geometry,
        color: m.color,
        resolved: Boolean(m.resolvedAt),
      })),
    [markups],
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
  }

  async function persistMarkup(geometry: MarkupGeometry) {
    if (!sheetId || !versionId) return;
    setBusy(true);
    setError(null);
    try {
      const created = await drawingMarkupApi.create(projectId, {
        documentId: sheetId,
        documentVersionId: versionId,
        pageNo,
        kind: geometry.kind,
        geometry,
      });
      setMarkups((prev) => [...prev, created]);
      setSelectedId(created.id);
    } catch (err) {
      console.error("markup create failed", err);
      setError(err instanceof Error && err.message ? err.message : "Couldn't save that markup.");
    } finally {
      setBusy(false);
    }
  }

  async function submitComment(draft: CommentDraft) {
    if (!sheetId || !versionId || !pendingAnchor) return;
    setBusy(true);
    setError(null);
    try {
      let fileId: string | null = null;
      if (draft.mediaUri && draft.mediaKind) {
        const media = draft.mediaKind === MEDIA_KIND.AUDIO ? VOICE_NOTE_FILE : VIDEO_NOTE_FILE;
        const uploaded = await uploadProjectFile(projectId, draft.mediaUri, media.name, media.mime);
        fileId = uploaded.id;
      }
      const created = await drawingMarkupApi.create(projectId, {
        documentId: sheetId,
        documentVersionId: versionId,
        pageNo,
        kind: MARKUP_KIND.PIN,
        geometry: { kind: MARKUP_KIND.PIN, at: pendingAnchor },
      });
      const comment = await drawingMarkupApi.addComment(projectId, created.id, {
        body: draft.text,
        mediaKind: draft.mediaKind,
        fileId,
        mediaDurationSeconds: draft.mediaDurationSeconds,
        assigneeId: draft.assigneeId,
      });
      setMarkups((prev) => [...prev, { ...created, comments: [comment] }]);
      setPendingAnchor(null);
      setSelectedId(created.id);
    } catch (err) {
      console.error("comment create failed", err);
      setError(err instanceof Error && err.message ? err.message : "Couldn't save that comment.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddComment(body: string) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const comment = await drawingMarkupApi.addComment(projectId, selected.id, { body });
      setMarkups((prev) =>
        prev.map((m) => (m.id === selected.id ? { ...m, comments: [...m.comments, comment] } : m)),
      );
    } catch (err) {
      console.error("markup comment failed", err);
      setError(err instanceof Error && err.message ? err.message : "Couldn't post that comment.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(resolved: boolean) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await drawingMarkupApi.setResolved(projectId, selected.id, resolved);
      setMarkups((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      console.error("markup resolve failed", err);
      setError(err instanceof Error && err.message ? err.message : "Couldn't update that markup.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await drawingMarkupApi.remove(projectId, selected.id);
      setMarkups((prev) => prev.filter((m) => m.id !== selected.id));
      setSelectedId(null);
    } catch (err) {
      console.error("markup delete failed", err);
      setError(err instanceof Error && err.message ? err.message : "Couldn't delete that markup.");
    } finally {
      setBusy(false);
    }
  }

  if (sheets.length === 0) {
    return (
      <Page title="Plan review" onBack={() => router.back()} scroll={false}>
        <View className="items-center py-12">
          <Text weight="semibold" className="text-base">
            No plans to review
          </Text>
          <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
            {plans.isPending ? "Loading plans…" : "Drawings uploaded to this project will appear here."}
          </Text>
        </View>
      </Page>
    );
  }

  const sidebar = pendingAnchor ? (
    <CommentComposer
      assignees={assignees}
      busy={busy}
      onCancel={() => setPendingAnchor(null)}
      onSubmit={(draft) => void submitComment(draft)}
    />
  ) : selected ? (
    <MarkupPanel
      markup={selected}
      busy={busy}
      onAddComment={(body) => void handleAddComment(body)}
      onResolve={(resolved) => void handleResolve(resolved)}
      onDelete={() => void handleDelete()}
      onClose={() => setSelectedId(null)}
      onError={setError}
    />
  ) : (
    <ToolHint tool={tool} />
  );

  return (
    <Page title={fileName || "Plan review"} onBack={() => router.back()} scroll={false} className="px-0 pb-0 pt-0">
      <View className="flex-1">
        <ReviewToolbar
          tool={tool}
          onSelectTool={setTool}
          pageNo={pageNo}
          pageCount={renderInfo?.pageCount ?? 1}
          onChangePage={(next) => {
            setPageNo(next);
            setSelectedId(null);
            setPendingAnchor(null);
          }}
        />

        <SheetStrip sheets={sheets} activeId={activeSheet?.id} onSelect={switchSheet} />

        {error ? (
          <View className="bg-error-50 px-4 py-2">
            <Text tone="danger" className="text-xs">
              {error}
            </Text>
          </View>
        ) : null}

        <View className={sidePanel ? "flex-1 flex-row" : "flex-1"}>
          <View className="flex-1 bg-[#EDEDED]">
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
          </View>
          {sidePanel ? <View className="w-96 border-l border-hairline bg-surface">{sidebar}</View> : null}
        </View>

        {!sidePanel ? sidebar : null}
      </View>
    </Page>
  );
}

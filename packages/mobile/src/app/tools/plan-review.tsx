import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { drawingMarkupApi, type DrawingMarkup } from "@/api/drawing-markup";
import { Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { MarkupPanel } from "@/components/plan-review/markup-panel";
import type {
  MarkupGeometry,
  SheetMarkup,
  SheetRenderInfo,
  SheetTool,
} from "@/components/plan-review/markup-types";
import SheetCanvas from "@/components/plan-review/sheet-canvas.dom";
import type { Db } from "@/db/client";
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

const TOOLS: { key: SheetTool; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: "navigate", icon: "move-outline", label: "Move" },
  { key: "pin", icon: "location-outline", label: "Pin" },
  { key: "pen", icon: "pencil-outline", label: "Draw" },
  { key: "cloud", icon: "square-outline", label: "Cloud" },
];

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
  const plans = useLocalDocuments(db, projectId, "plan");

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
  const [tool, setTool] = useState<SheetTool>("navigate");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [markups, setMarkups] = useState<DrawingMarkup[]>([]);
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
    setMarkups([]);
    setError(null);
  }

  async function handleCreate(geometry: MarkupGeometry) {
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

  const pageCount = renderInfo?.pageCount ?? 1;

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

  return (
    <Page title={fileName || "Plan review"} onBack={() => router.back()} scroll={false} className="px-0 pb-0 pt-0">
      <View className="flex-1">
        <View className="flex-row items-center gap-2 border-b border-hairline bg-surface px-4 py-2">
          {TOOLS.map((t) => {
            const active = tool === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTool(t.key)}
                accessibilityRole="button"
                accessibilityLabel={t.label}
                className={`h-11 flex-row items-center gap-1.5 rounded-full px-3.5 ${active ? "bg-primary-500" : "bg-surface-alt"}`}
              >
                <Ionicons name={t.icon} size={17} color={active ? "#FFFFFF" : "#5C5C5C"} />
                <Text weight="semibold" className={`text-[13px] ${active ? "text-white" : "text-ink-secondary"}`}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
          <View className="flex-1" />
          {pageCount > 1 ? (
            <View className="flex-row items-center gap-1">
              <Pressable
                onPress={() => setPageNo((p) => Math.max(1, p - 1))}
                disabled={pageNo <= 1}
                accessibilityRole="button"
                accessibilityLabel="Previous page"
                className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt"
              >
                <Ionicons name="chevron-back" size={20} color={pageNo <= 1 ? "#ADADAD" : "#1A1A1A"} />
              </Pressable>
              <Text tone="secondary" className="text-xs">
                {pageNo} / {pageCount}
              </Text>
              <Pressable
                onPress={() => setPageNo((p) => Math.min(pageCount, p + 1))}
                disabled={pageNo >= pageCount}
                accessibilityRole="button"
                accessibilityLabel="Next page"
                className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt"
              >
                <Ionicons name="chevron-forward" size={20} color={pageNo >= pageCount ? "#ADADAD" : "#1A1A1A"} />
              </Pressable>
            </View>
          ) : null}
        </View>

        {sheets.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-14 border-b border-hairline bg-surface">
            <View className="flex-row items-center gap-2 px-4 py-2">
              {sheets.map((s, index) => {
                const active = s.id === activeSheet?.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => switchSheet(s.id)}
                    accessibilityRole="button"
                    className={`h-9 flex-row items-center rounded-full px-3 ${active ? "bg-primary-50" : "bg-surface-alt"}`}
                  >
                    <Text weight="semibold" className={`text-xs ${active ? "text-primary-600" : "text-ink-secondary"}`}>
                      P-{String(index + 1).padStart(2, "0")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : null}

        {error ? (
          <View className="bg-error-50 px-4 py-2">
            <Text tone="danger" className="text-xs">
              {error}
            </Text>
          </View>
        ) : null}

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
              onCreate={handleCreate}
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

        {selected ? (
          <MarkupPanel
            markup={selected}
            busy={busy}
            onAddComment={(body) => void handleAddComment(body)}
            onResolve={(resolved) => void handleResolve(resolved)}
            onDelete={() => void handleDelete()}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <View className="border-t border-hairline bg-surface px-4 py-3">
            <Text tone="secondary" className="text-center text-xs">
              {tool === "navigate"
                ? "Pinch to zoom · drag to pan · tap a markup to open it"
                : tool === "pin"
                  ? "Tap the sheet to drop a pin"
                  : tool === "pen"
                    ? "Draw on the sheet with your finger"
                    : "Drag a box around the area to cloud"}
            </Text>
          </View>
        )}
      </View>
    </Page>
  );
}

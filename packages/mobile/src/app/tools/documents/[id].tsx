import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { documentsApi, type DocumentVersion } from "@/api/documents";
import { Card, Spinner, Text } from "@/components/atoms";
import { ICON_BRAND } from "@/constants/colors";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
import { useLocalDb } from "@/db/provider";
import { cacheDocument, cacheVersionFile } from "@/lib/download-file";
import { formatDate } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";

function VersionRow({
  version,
  projectId,
  documentId,
  onError,
}: {
  version: DocumentVersion;
  projectId: string;
  documentId: string;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleView() {
    setBusy(true);
    try {
      const uri = await cacheVersionFile(projectId, documentId, version.id, version.fileName);
      router.push(
        `/tools/documents/view?uri=${encodeURIComponent(uri)}&name=${encodeURIComponent(version.fileName)}` as never,
      );
    } catch (err) {
      console.error("version download failed", err);
      onError(
        err instanceof Error && err.message
          ? `Couldn't open this version: ${err.message}`
          : "Couldn't open this version. Try again when you have signal.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      onPress={handleView}
      disabled={busy}
      accessibilityRole="button"
      className="min-h-16 flex-row items-center gap-3 border-b border-hairline px-4 py-3 active:bg-surface-alt"
    >
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text weight="semibold" className="text-[15px]">
            v{version.versionNo}
            {version.revisionLabel ? ` · ${version.revisionLabel}` : ""}
          </Text>
          {version.isCurrent ? (
            <View className="rounded-full bg-success-50 px-2 py-0.5">
              <Text weight="semibold" tone="brand" className="text-[9px] uppercase">Current</Text>
            </View>
          ) : null}
        </View>
        <Text tone="secondary" className="pt-0.5 text-xs">
          {version.fileName} · {version.size} · {formatDate(version.createdAt)}
        </Text>
        {version.notes ? (
          <Text tone="secondary" className="pt-1 text-xs">{version.notes}</Text>
        ) : null}
      </View>
      {busy ? <Spinner size="xs" /> : <Ionicons name="open-outline" size={18} color={ICON_BRAND} />}
    </Pressable>
  );
}

export default function DocumentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db } = useLocalDb();
  const { isOnline } = useSyncState();

  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  // Version history is read from the server; there is no local copy of it yet.
  // Losing signal is the normal case here, so it gets a sentence, not silence.
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [caching, setCaching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !id) return;
    let cancelled = false;
    setHistoryUnavailable(false);
    documentsApi
      .versions(projectId, id)
      .then((v) => {
        if (!cancelled) setVersions(v);
      })
      .catch(() => {
        if (!cancelled) setHistoryUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, id, isOnline]);

  async function handleCacheForOffline() {
    if (!db || !projectId || !id) return;
    setCaching(true);
    setError(null);
    try {
      await cacheDocument(db, projectId, id);
      const { documentsRepository } = await import("@/db/documents-repository");
      await documentsRepository.trackAccess(db, id);
    } catch (err) {
      console.error("offline cache failed", err);
      setError(err instanceof Error && err.message ? err.message : "Couldn't save this document for offline.");
    }
    finally { setCaching(false); }
  }

  return (
    <Page
      title="Document"
      onBack={() => router.back()}
      rightButtons={
        <HeaderIconButton icon="cloud-download-outline" label="Save for offline" onPress={handleCacheForOffline} busy={caching} />
      }
    >
      {error ? (
        <View className="mb-4 rounded-xl bg-error-50 px-4 py-3">
          <Text tone="danger" className="text-sm">{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className="items-center py-12"><Spinner size="md" /></View>
      ) : historyUnavailable ? (
        <View className="items-center py-12">
          <Text weight="semibold" className="text-center text-base">
            Version history needs signal
          </Text>
          <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
            {isOnline
              ? "Couldn't load this document's versions. Pull back to the list and try again."
              : "You're offline. The versions load on their own once you're back online; a copy saved for offline still opens from the list."}
          </Text>
        </View>
      ) : versions.length === 0 ? (
        <View className="items-center py-12">
          <Text weight="semibold" className="text-center text-base">
            No versions yet
          </Text>
          <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
            Versions appear here each time this document is re-uploaded.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          <Text weight="bold" className="text-base">Version history</Text>
          <Card>
            {versions.map((v) => (
              <VersionRow key={v.id} version={v} projectId={projectId!} documentId={id!} onError={setError} />
            ))}
          </Card>
        </View>
      )}
    </Page>
  );
}

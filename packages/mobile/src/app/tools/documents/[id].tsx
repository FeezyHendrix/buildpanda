import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { documentsApi, type DocumentVersion } from "@/api/documents";
import { Card, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { useLocalDb } from "@/db/provider";
import { cacheDocument, cacheVersionFile } from "@/lib/download-file";
import { useFieldSession } from "@/lib/field-session";
import { cn } from "@/lib/utils";

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

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
          {version.fileName} · {version.size} · {timeLabel(version.createdAt)}
        </Text>
        {version.notes ? (
          <Text tone="secondary" className="pt-1 text-xs">{version.notes}</Text>
        ) : null}
      </View>
      {busy ? <Spinner size="xs" /> : <Ionicons name="open-outline" size={18} color="#004DE7" />}
    </Pressable>
  );
}

export default function DocumentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db } = useLocalDb();

  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [caching, setCaching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !id) return;
    let cancelled = false;
    documentsApi.versions(projectId, id).then((v) => {
      if (!cancelled) setVersions(v);
    }).catch(() => undefined).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, id]);

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
        <Pressable
          onPress={handleCacheForOffline}
          disabled={caching}
          accessibilityRole="button"
          accessibilityLabel="Save for offline"
          className="h-11 w-11 items-center justify-center rounded-full active:bg-white/20"
        >
          {caching ? <Spinner size="xs" tone="current" /> : <Ionicons name="cloud-download-outline" size={22} color="#FFFFFF" />}
        </Pressable>
      }
    >
      {error ? (
        <View className="mb-4 rounded-xl bg-error-50 px-4 py-3">
          <Text tone="danger" className="text-sm">{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className="items-center py-12"><Spinner size="md" /></View>
      ) : versions.length === 0 ? (
        <View className="items-center py-12">
          <Text tone="secondary" className="text-[13px]">No versions found.</Text>
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

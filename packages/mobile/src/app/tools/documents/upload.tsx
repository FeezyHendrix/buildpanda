import Ionicons from "@expo/vector-icons/Ionicons";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { documentsApi, type DocumentCategory } from "@/api/documents";
import { Button, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { useDocumentCategories } from "@/hooks/use-local-documents";
import { useLocalDb } from "@/db/provider";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";
import { cn } from "@/lib/utils";
import type { Db } from "@/db/client";
import type { DocumentGroup } from "@/db/documents-repository";

function CategoryPicker({
  db,
  projectId,
  group,
  selectedId,
  onSelect,
}: {
  db: Db;
  projectId: string;
  group: DocumentGroup;
  selectedId: string | null;
  onSelect: (id: string, name: string) => void;
}) {
  const { data, isPending } = useDocumentCategories(db, projectId, group);

  if (isPending) return <Spinner size="sm" />;
  if (data.length === 0) {
    return <Text tone="secondary" className="text-[13px]">No categories yet.</Text>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {data.map((cat) => {
        const active = cat.id === selectedId;
        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.id, cat.name)}
            className={cn(
              "min-h-10 justify-center rounded-xl px-4",
              active ? "bg-primary-500" : "bg-surface-alt",
            )}
          >
            <Text weight="semibold" tone={active ? "inverse" : "secondary"} className="text-[13px]">
              {cat.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function UploadDocument() {
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const { isOnline } = useSyncState();

  const [file, setFile] = useState<{ uri: string; name: string; mimeType: string; size: number } | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? "application/octet-stream", size: asset.size ?? 0 });
  }

  async function handleUpload() {
    if (!file || !categoryId || !projectId) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await documentsApi.uploadFile(projectId, file.uri, file.name, file.mimeType);
      await documentsApi.createDocument(projectId, {
        categoryId,
        fileId: uploaded.id,
        fileName: uploaded.fileName,
        size: `${Math.round(uploaded.sizeBytes / 1024)} KB`,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const canSubmit = Boolean(file && categoryId && !uploading);

  return (
    <Page
      title="Upload document"
      onBack={() => router.back()}
      footer={
        <Button onPress={handleUpload} disabled={!canSubmit} loading={uploading}>
          Upload
        </Button>
      }
    >
      {!isOnline ? (
        <View className="mb-4 rounded-xl bg-surface-alt px-4 py-3">
          <Text tone="secondary" className="text-[13px]">
            You need a connection to upload files.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View className="mb-4 rounded-xl bg-error-50 px-4 py-3">
          <Text tone="danger" className="text-sm">{error}</Text>
        </View>
      ) : null}

      <View className="gap-5">
        <View>
          <Text weight="semibold" className="pb-2 text-[13px]">File</Text>
          {file ? (
            <View className="flex-row items-center gap-3 rounded-xl bg-surface-alt px-4 py-3">
              <Ionicons name="document-outline" size={20} color="#004DE7" />
              <View className="min-w-0 flex-1">
                <Text weight="semibold" className="text-[15px]" numberOfLines={1}>{file.name}</Text>
                <Text tone="secondary" className="text-xs">{Math.round(file.size / 1024)} KB</Text>
              </View>
              <Pressable onPress={pickFile} hitSlop={8}>
                <Text tone="brand" weight="semibold" className="text-xs">Change</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={pickFile}
              className="min-h-24 items-center justify-center gap-2 rounded-xl border border-dashed border-grey-200 active:bg-surface-alt"
            >
              <Ionicons name="cloud-upload-outline" size={28} color="#ADADAD" />
              <Text tone="secondary" className="text-[13px]">Tap to pick a file</Text>
            </Pressable>
          )}
        </View>

        <View>
          <Text weight="semibold" className="pb-2 text-[13px]">Category</Text>
          {ready && db && projectId ? (
            <CategoryPicker
              db={db}
              projectId={projectId}
              group="document"
              selectedId={categoryId}
              onSelect={(id, name) => { setCategoryId(id); setCategoryName(name); }}
            />
          ) : <Spinner size="sm" />}
          {categoryName ? (
            <Text tone="secondary" className="pt-1 text-xs">Selected: {categoryName}</Text>
          ) : null}
        </View>
      </View>
    </Page>
  );
}

import Ionicons from "@expo/vector-icons/Ionicons";
import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, FieldLabel, OptionRow, Spinner, Text } from "@/components/atoms";
import { ICON_BRAND, ICON_SUBTLE } from "@/constants/colors";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { DOCUMENT_GROUP, documentsRepository, type DocumentGroup } from "@/db/documents-repository";
import { flushOutbox } from "@/db/outbox";
import { useLocalDb } from "@/db/provider";
import { useDocumentCategories } from "@/hooks/use-local-documents";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";

// The web's "Upload plan" and "Upload document" dialogs, as one page that
// takes the group from the tab it was opened from. Nothing here needs signal:
// the file is copied somewhere durable and queued, and uploads when it can.

interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

interface Category {
  id: string;
  name: string;
}

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
  onSelect: (category: Category) => void;
}) {
  const { data, isPending } = useDocumentCategories(db, projectId, group);

  if (isPending || data.length === 0) {
    return (
      <View className="gap-2">
        <FieldLabel>Folder</FieldLabel>
        {isPending ? (
          <View className="items-start py-2">
            <Spinner size="sm" />
          </View>
        ) : (
          <Text tone="secondary" className="text-[13px]">
            {group === DOCUMENT_GROUP.PLAN
              ? "No plan folders yet. Open this project once with signal to fetch them."
              : "No document folders yet. Open this project once with signal to fetch them."}
          </Text>
        )}
      </View>
    );
  }

  return (
    <OptionRow
      label="Folder"
      options={data.map((cat) => ({ value: cat.id, label: cat.name }))}
      value={selectedId ?? ""}
      onChange={(id) => {
        const cat = data.find((row) => row.id === id);
        if (cat) onSelect({ id: cat.id, name: cat.name });
      }}
    />
  );
}

export default function UploadDocument() {
  const params = useLocalSearchParams<{ group?: string }>();
  const group: DocumentGroup = params.group === DOCUMENT_GROUP.PLAN ? DOCUMENT_GROUP.PLAN : DOCUMENT_GROUP.DOCUMENT;
  const isPlan = group === DOCUMENT_GROUP.PLAN;

  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const { isOnline } = useSyncState();

  const [file, setFile] = useState<PickedFile | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? "application/octet-stream",
      size: asset.size ?? 0,
    });
  }

  async function handleQueue() {
    if (!file || !category || !projectId || !db) return;
    setSaving(true);
    setError(null);
    try {
      await documentsRepository.createLocal(db, projectId, {
        uri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.size,
        categoryId: category.id,
        categoryName: category.name,
        group,
      });
      // the row is safe on disk; the push is a bonus if there is signal right now
      void flushOutbox(db).catch(() => undefined);
      router.back();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't save that file.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = Boolean(file && category && db && !saving);

  return (
    <Page
      title={isPlan ? "Upload plan" : "Upload document"}
      onBack={() => router.back()}
      footer={
        <Button onPress={handleQueue} disabled={!canSubmit} loading={saving}>
          {isOnline ? "Upload" : "Queue upload"}
        </Button>
      }
    >
      {!isOnline ? (
        <View className="mb-4 rounded-xl bg-surface-alt px-4 py-3">
          <Text tone="secondary" className="text-[13px]">
            No signal. The file is kept on this device and uploads on its own once you are back online.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View className="mb-4 rounded-xl bg-error-50 px-4 py-3">
          <Text tone="danger" className="text-sm">{error}</Text>
        </View>
      ) : null}

      <View className="gap-5">
        <View className="gap-2">
          <FieldLabel>File</FieldLabel>
          {file ? (
            <View className="flex-row items-center gap-3 rounded-xl bg-surface-alt px-4 py-3">
              <Ionicons name={isPlan ? "map-outline" : "document-outline"} size={20} color={ICON_BRAND} />
              <View className="min-w-0 flex-1">
                <Text weight="semibold" className="text-[15px]" numberOfLines={1}>{file.name}</Text>
                <Text tone="secondary" className="text-xs">{Math.round(file.size / 1024)} KB</Text>
              </View>
              <Pressable
                onPress={pickFile}
                accessibilityRole="button"
                accessibilityLabel="Choose a different file"
                className="min-h-11 min-w-11 items-center justify-center rounded-lg px-3 active:bg-hairline"
              >
                <Text tone="brand" weight="semibold" className="text-[13px]">Change</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={pickFile}
              accessibilityRole="button"
              className="min-h-24 items-center justify-center gap-2 rounded-xl border border-dashed border-grey-200 active:bg-surface-alt"
            >
              <Ionicons name="cloud-upload-outline" size={28} color={ICON_SUBTLE} />
              <Text tone="secondary" className="text-[13px]">
                {isPlan ? "Tap to pick a drawing" : "Tap to pick a file"}
              </Text>
            </Pressable>
          )}
        </View>

        {ready && db && projectId ? (
          <CategoryPicker
            db={db}
            projectId={projectId}
            group={group}
            selectedId={category?.id ?? null}
            onSelect={setCategory}
          />
        ) : (
          <View className="gap-2">
            <FieldLabel>Folder</FieldLabel>
            <View className="items-start py-2">
              <Spinner size="sm" />
            </View>
          </View>
        )}
      </View>
    </Page>
  );
}

import { goBack } from "@/lib/navigation";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, FieldLabel, Text } from "@/components/atoms";
import { ICON_BRAND, ICON_SUBTLE } from "@/constants/colors";
import { Page } from "@/components/molecules/page";
import { DOCUMENT_GROUP, documentsRepository } from "@/db/documents-repository";
import { flushOutbox } from "@/db/outbox";
import { useLocalDb } from "@/db/provider";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";

// Files are saved locally first and uploaded when the device reconnects.

interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export default function UploadDocument() {
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const { isOnline } = useSyncState();

  const [file, setFile] = useState<PickedFile | null>(null);
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
    if (!file || !projectId || !db || !ready) return;
    setSaving(true);
    setError(null);
    try {
      await documentsRepository.createLocal(db, projectId, {
        uri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.size,
        group: DOCUMENT_GROUP.DOCUMENT,
      });
      // the row is safe on disk; the push is a bonus if there is signal right now
      void flushOutbox(db).catch(() => undefined);
      goBack();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't save that file.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = Boolean(file && projectId && db && ready && !saving);

  return (
    <Page
      title="Add file"
      onBack={() => goBack()}
      footer={
        <Button onPress={handleQueue} disabled={!canSubmit} loading={saving}>
          {isOnline ? "Upload" : "Queue upload"}
        </Button>
      }
    >
      {!isOnline ? (
        <View className="mb-4 rounded-xl bg-surface-alt px-4 py-3">
          <Text tone="secondary" className="text-[13px]">
            No signal. The file is kept on this device and uploads on its own once you are back
            online.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View className="mb-4 rounded-xl bg-error-50 px-4 py-3">
          <Text tone="danger" className="text-sm">
            {error}
          </Text>
        </View>
      ) : null}

      <View className="gap-5">
        <View className="gap-2">
          <FieldLabel>File</FieldLabel>
          {file ? (
            <View className="flex-row items-center gap-3 rounded-xl bg-surface-alt px-4 py-3">
              <Ionicons name="document-outline" size={20} color={ICON_BRAND} />
              <View className="min-w-0 flex-1">
                <Text weight="semibold" className="text-[15px]" numberOfLines={1}>
                  {file.name}
                </Text>
                <Text tone="secondary" className="text-xs">
                  {Math.round(file.size / 1024)} KB
                </Text>
              </View>
              <Pressable
                onPress={pickFile}
                accessibilityRole="button"
                accessibilityLabel="Choose a different file"
                className="min-h-11 min-w-11 items-center justify-center rounded-lg px-3 active:bg-hairline"
              >
                <Text tone="brand" weight="semibold" className="text-[13px]">
                  Change
                </Text>
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
                Tap to pick a file
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Page>
  );
}

import Ionicons from "@expo/vector-icons/Ionicons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { uploadProjectFile } from "@/api/files";
import { Spinner, Text } from "@/components/atoms";

interface PickedAttachment {
  readonly uri: string;
  readonly fileName: string;
  readonly mimeType: string;
}

interface Props {
  readonly projectId: string;
  readonly onUploaded: (file: { readonly id: string; readonly fileName: string; readonly mimeType: string }) => void;
  readonly onError: (message: string) => void;
}

async function pickCamera(): Promise<PickedAttachment | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error("Camera access is off. Enable it in Settings to take site photos.");
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.75 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, fileName: asset.fileName ?? "site-photo.jpg", mimeType: asset.mimeType ?? "image/jpeg" };
}

async function pickLibrary(): Promise<PickedAttachment | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("Photo library access is off. Enable it in Settings to attach site media.");
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], quality: 0.75 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, fileName: asset.fileName ?? "site-media", mimeType: asset.mimeType ?? "application/octet-stream" };
}

async function pickDocument(): Promise<PickedAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType ?? "application/octet-stream" };
}

export function AttachmentButtons({ projectId, onUploaded, onError }: Props) {
  const [busy, setBusy] = useState<"camera" | "library" | "file" | null>(null);

  async function handlePick(kind: "camera" | "library" | "file") {
    setBusy(kind);
    onError("");
    try {
      const picked = kind === "camera" ? await pickCamera() : kind === "library" ? await pickLibrary() : await pickDocument();
      if (!picked) return;
      const uploaded = await uploadProjectFile(projectId, picked.uri, picked.fileName, picked.mimeType);
      onUploaded({ id: uploaded.id, fileName: uploaded.fileName, mimeType: picked.mimeType });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Attachment upload failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View className="flex-row flex-wrap gap-2 border-t border-hairline bg-surface px-3 py-2">
      <AttachmentButton icon="camera-outline" label="Camera" busy={busy === "camera"} onPress={() => handlePick("camera")} />
      <AttachmentButton icon="images-outline" label="Library" busy={busy === "library"} onPress={() => handlePick("library")} />
      <AttachmentButton icon="document-attach-outline" label="File" busy={busy === "file"} onPress={() => handlePick("file")} />
    </View>
  );
}

function AttachmentButton({ icon, label, busy, onPress }: { readonly icon: keyof typeof Ionicons.glyphMap; readonly label: string; readonly busy: boolean; readonly onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`Attach from ${label}`}
      className="min-h-11 flex-row items-center gap-1.5 rounded-full bg-primary-50 px-3 active:bg-primary-100"
    >
      {busy ? <Spinner size="xs" /> : <Ionicons name={icon} size={15} color="#004DE7" />}
      <Text weight="semibold" tone="brand" className="text-xs">
        {label}
      </Text>
    </Pressable>
  );
}

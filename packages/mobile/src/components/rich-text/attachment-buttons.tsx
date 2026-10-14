import { contentWork } from "@buildpanda/rich-content/pending";
import { MAX_CONTENT_IMAGES } from "@buildpanda/rich-content";
import { stageContentImage } from "@/lib/content-images";
import { requireAccess, requireCurrentAccess } from "@/lib/project-access-store";
import { uploadAccess } from "@/lib/feature-access";
import { useProjectAccess } from "@/lib/project-access-provider";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { uploadProjectFile } from "@/api/files";
import { Spinner, Text } from "@/components/atoms";
import { ICON_BRAND } from "@/constants/colors";

interface PickedAttachment {
  readonly uri: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size?: number;
}

interface Props {
  readonly projectId: string;
  readonly imagesOnly?: boolean;
  readonly imageCount?: number;
  readonly onUploaded: (file: { readonly id: string; readonly fileName: string; readonly mimeType: string }) => void;
  readonly onError: (message: string) => void;
}

async function pickCamera(): Promise<PickedAttachment | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error("Camera access is off. Enable it in Settings to take site photos.");
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.75, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, fileName: asset.fileName ?? "site-photo.jpg", mimeType: asset.mimeType ?? "image/jpeg", size: asset.fileSize };
}

async function pickLibrary(imagesOnly: boolean): Promise<PickedAttachment | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("Photo library access is off. Enable it in Settings to attach site media.");
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: imagesOnly ? ["images"] : ["images", "videos"], quality: 0.75, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, fileName: asset.fileName ?? "site-media", mimeType: asset.mimeType ?? "application/octet-stream", size: asset.fileSize };
}

async function pickDocument(): Promise<PickedAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType ?? "application/octet-stream" };
}

export function AttachmentButtons({ projectId, onUploaded, onError, imagesOnly = false, imageCount = 0 }: Props) {
  const { allows, scope } = useProjectAccess();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState<"camera" | "library" | "file" | null>(null);

  async function handlePick(kind: "camera" | "library" | "file") {
    if (inFlight.current) return;
    inFlight.current = true;
    const finish = contentWork.begin();
    setBusy(kind);
    onError("");
    try {
      const ticket = requireAccess(projectId, uploadAccess);
      const picked = kind === "camera" ? await pickCamera() : kind === "library" ? await pickLibrary(imagesOnly) : await pickDocument();
      requireCurrentAccess(ticket);
      if (!picked) return;
      if (picked.mimeType.startsWith("image/")) {
        if (imageCount >= MAX_CONTENT_IMAGES) throw new Error(`Add up to ${MAX_CONTENT_IMAGES} images per field.`);
        const image = await stageContentImage(projectId, picked);
        onUploaded({ id: image.fileId, fileName: image.name, mimeType: picked.mimeType });
      } else {
        const uploaded = await uploadProjectFile(projectId, picked.uri, picked.fileName, picked.mimeType);
        requireCurrentAccess(ticket);
        onUploaded({ id: uploaded.id, fileName: uploaded.fileName, mimeType: picked.mimeType });
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Attachment upload failed.");
    } finally {
      finish();
      inFlight.current = false;
      setBusy(null);
    }
  }

  if (scope?.projectId !== projectId || !allows(uploadAccess)) return null;
  return (
    <View className="flex-row flex-wrap gap-2 border-t border-hairline bg-surface px-3 py-2">
      <AttachmentButton disabled={busy !== null} icon="camera-outline" label="Camera" busy={busy === "camera"} onPress={() => handlePick("camera")} />
      <AttachmentButton disabled={busy !== null} icon="images-outline" label="Library" busy={busy === "library"} onPress={() => handlePick("library")} />
      {!imagesOnly ? <AttachmentButton disabled={busy !== null} icon="document-attach-outline" label="File" busy={busy === "file"} onPress={() => handlePick("file")} /> : null}
    </View>
  );
}

function AttachmentButton({ icon, label, busy, disabled, onPress }: { readonly disabled?: boolean; readonly icon: keyof typeof Ionicons.glyphMap; readonly label: string; readonly busy: boolean; readonly onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Attach from ${label}`}
      className="min-h-11 flex-row items-center gap-1.5 rounded-full bg-primary-50 px-3 active:bg-primary-100"
    >
      {busy ? <Spinner size="xs" /> : <Ionicons name={icon} size={15} color={ICON_BRAND} />}
      <Text weight="semibold" tone="brand" className="text-xs">
        {label}
      </Text>
    </Pressable>
  );
}

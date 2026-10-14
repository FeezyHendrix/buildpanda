import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { FieldLabel, Spinner, Text } from "@/components/atoms";
import { ICON_BRAND, ICON_INVERSE, ICON_MUTED } from "@/constants/colors";

export interface PickedUpdateMedia {
  uri: string;
  fileName: string;
  mimeType: string | null;
  type: "photo" | "video";
}

function toPicked(asset: ImagePicker.ImagePickerAsset): PickedUpdateMedia {
  const isVideo = asset.type === "video";
  return {
    uri: asset.uri,
    fileName: asset.fileName ?? (isVideo ? "site-video.mp4" : "site-photo.jpg"),
    mimeType: asset.mimeType ?? null,
    type: isVideo ? "video" : "photo",
  };
}

async function pickFromCamera(): Promise<PickedUpdateMedia[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Camera access is off. Enable it in Settings to take site photos.");
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.75 });
  return result.canceled ? [] : result.assets.map(toPicked);
}

async function pickFromLibrary(remaining: number): Promise<PickedUpdateMedia[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Photo library access is off. Enable it in Settings to attach site media.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    quality: 0.75,
    allowsMultipleSelection: true,
    selectionLimit: remaining,
  });
  return result.canceled ? [] : result.assets.map(toPicked);
}

function Thumbnail({ item, onRemove }: { item: PickedUpdateMedia; onRemove: () => void }) {
  return (
    <View
      className="w-[31.5%] overflow-hidden rounded-xl bg-surface-alt"
      style={{ aspectRatio: 1 }}
    >
      {item.type === "video" ? (
        <View className="flex-1 items-center justify-center gap-1">
          <Ionicons name="videocam-outline" size={22} color={ICON_MUTED} />
          <Text tone="secondary" className="text-[10px] uppercase">
            Video
          </Text>
        </View>
      ) : (
        <Image source={{ uri: item.uri }} contentFit="cover" style={{ flex: 1 }} />
      )}
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.fileName}`}
        className="absolute right-0 top-0 h-11 w-11 items-center justify-center"
      >
        <View className="h-6 w-6 items-center justify-center rounded-full bg-black-500/70">
          <Ionicons name="close" size={14} color={ICON_INVERSE} />
        </View>
      </Pressable>
    </View>
  );
}

function PickerButton({
  icon,
  label,
  busy,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-11 min-w-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-grey-200 px-4 active:bg-surface-alt"
    >
      {busy ? <Spinner size="xs" /> : <Ionicons name={icon} size={20} color={ICON_BRAND} />}
      <Text weight="semibold" tone="brand" className="text-[13px]">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Photos and videos attached to an update, held as local files.
 *
 * Nothing is uploaded here: the bytes stay on the device and the outbox sends
 * them when there is signal, so this works with no network at all.
 */
export function UpdateMediaPicker({
  media,
  onChange,
  onError,
  max = 10,
}: {
  media: readonly PickedUpdateMedia[];
  onChange: (next: PickedUpdateMedia[]) => void;
  onError: (message: string) => void;
  /** The create endpoint refuses more than ten attachments. */
  max?: number;
}) {
  const [busy, setBusy] = useState<"camera" | "library" | null>(null);
  const remaining = max - media.length;

  async function handlePick(kind: "camera" | "library") {
    setBusy(kind);
    onError("");
    try {
      const picked = kind === "camera" ? await pickFromCamera() : await pickFromLibrary(remaining);
      if (picked.length > 0) onChange([...media, ...picked].slice(0, max));
    } catch (error) {
      onError(error instanceof Error ? error.message : "That attachment could not be added.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View className="gap-2">
      <FieldLabel>Photos &amp; videos</FieldLabel>

      {media.length > 0 ? (
        <View className="flex-row flex-wrap gap-3">
          {media.map((item, index) => (
            <Thumbnail
              key={`${item.uri}-${index}`}
              item={item}
              onRemove={() => onChange(media.filter((_, at) => at !== index))}
            />
          ))}
        </View>
      ) : null}

      {remaining > 0 ? (
        <View className="flex-row gap-3">
          <PickerButton
            icon="camera-outline"
            label="Camera"
            busy={busy === "camera"}
            onPress={() => handlePick("camera")}
          />
          <PickerButton
            icon="images-outline"
            label="Library"
            busy={busy === "library"}
            onPress={() => handlePick("library")}
          />
        </View>
      ) : null}

      <Text tone="muted" className="text-xs">
        {remaining > 0
          ? `Optional. ${remaining} more can be attached; they upload when you get signal.`
          : "Ten attachments is the limit for one update."}
      </Text>
    </View>
  );
}

UpdateMediaPicker.displayName = "UpdateMediaPicker";

import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { Pressable, View } from "react-native";
import { Button, Spinner, Text } from "@/components/atoms";
import { ImageModal } from "@/components/rich-text/rich-content";
import { useContentImage } from "@/hooks/use-content-image";
import { useContentFileOpener } from "@/hooks/use-content-file-opener";
import { loadPendingMedia } from "@/lib/pending-media";
import { useProjectAccess } from "@/lib/project-access-provider";
import { features } from "@/lib/feature-access";

export interface GalleryMedia { id: string; type: "photo" | "video"; url: string; fileName?: string; staged?: boolean }

function MediaPreview({ media }: { media: GalleryMedia }) {
  const { scope, generation, allows } = useProjectAccess();
  const permitted = allows(features.updates.read);
  const fileId = !media.staged ? /\/files\/([\w-]+)\/(?:view|download)(?:[?#]|$)/.exec(media.url)?.[1] ?? "" : "";
  const image = useContentImage(media.type === "photo" ? fileId : "", scope?.projectId);
  const [local, setLocal] = useState({ key: "", uri: "", error: "" });
  const key = `${media.id}:${media.url}:${scope?.projectId}:${generation}`;
  const [expanded, setExpanded] = useState(false);
  const file = useContentFileOpener(scope?.projectId);
  useEffect(() => {
    let active = true;
    if (media.staged && permitted) void loadPendingMedia(media.url)
      .then((uri) => { if (active) setLocal({ key, uri, error: "" }); })
      .catch(() => { if (active) setLocal({ key, uri: "", error: "This attachment is no longer on this device." }); });
    return () => { active = false; };
  }, [key, media.staged, media.url, permitted]);
  if (!permitted) return null;
  if (media.type === "video") return <View className="min-h-32 items-center justify-center gap-2 rounded-xl bg-surface-alt p-4">
    <Text weight="semibold">Video attachment</Text>
    {fileId ? <Button variant="secondary" onPress={() => void file.open(fileId)}>Open video</Button> : <Text tone="secondary">Video saved on this device. Playback is available after upload.</Text>}
    {file.error ? <Text tone="danger">{file.error}</Text> : null}
  </View>;
  const uri = media.staged ? local.key === key ? local.uri : "" : fileId ? image.url : /^https:\/\//.test(media.url) ? media.url : "";
  const error = media.staged ? local.key === key ? local.error : "" : image.error;
  const name = media.fileName || "Update photo";
  if (!uri) return <View className="h-56 items-center justify-center rounded-xl bg-surface-alt p-4">
    {error ? <Text tone="secondary">{error}</Text> : <Spinner />}
  </View>;
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}`} onPress={() => setExpanded(true)}>
      <Image source={{ uri }} contentFit="cover" accessibilityLabel={name} style={{ height: 280, width: "100%", borderRadius: 12 }} />
    </Pressable>
    <ImageModal url={uri} name={name} visible={expanded} onClose={() => setExpanded(false)} />
  </View>;
}

export function MediaGallery({ media }: { media: readonly GalleryMedia[] }) {
  const [index, setIndex] = useState(0);
  if (!media.length) return null;
  const position = Math.min(index, media.length - 1);
  return <View className="gap-2">
    <MediaPreview key={media[position]!.id} media={media[position]!} />
    {media.length > 1 ? <View className="flex-row items-center justify-between gap-2">
      <Button variant="ghost" disabled={position === 0} onPress={() => setIndex(position - 1)}>Previous photo</Button>
      <Text tone="secondary" className="text-xs">{position + 1} / {media.length}</Text>
      <Button variant="ghost" disabled={position === media.length - 1} onPress={() => setIndex(position + 1)}>Next photo</Button>
    </View> : null}
  </View>;
}

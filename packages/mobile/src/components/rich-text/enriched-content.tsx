import { useState } from "react";
import { Linking, View } from "react-native";
import { EnrichedText } from "react-native-enriched-html";
import { embeddedImages, fileIdFromPath, type ContentImage } from "@buildpanda/rich-content";
import { Text } from "@/components/atoms/text";
import { Button } from "@/components/atoms/button";
import { useContentFileOpener } from "@/hooks/use-content-file-opener";
import { useEditorImages } from "./use-editor-images";
import { richTextDocument, safeRichTextLink } from "./html-document";
import { enrichedHtmlStyle, enrichedSanitization, enrichedStyles } from "./enriched-theme";

export function EnrichedContent({ html, projectId, onImage }: { html: string; projectId?: string; onImage: (image: ContentImage) => void }) {
  const assets = useEditorImages(html, projectId);
  const files = useContentFileOpener(projectId);
  const [error, setError] = useState("");
  const images = [...new Map(embeddedImages(html).map((image) => [image.fileId, image])).values()];
  async function open(url: string) {
    try {
      const fileId = fileIdFromPath(url);
      if (fileId) await files.open(fileId);
      else if (safeRichTextLink(url)) await Linking.openURL(url);
    } catch { setError("Could not open this link."); }
  }
  return <View>
    <EnrichedText selectable style={enrichedStyles.text} htmlStyle={enrichedHtmlStyle} sanitizationConfig={enrichedSanitization}
      onLinkPress={({ url }) => { void open(url); }}>{richTextDocument(html, assets.images, true)}</EnrichedText>
    {/* Enriched 1.1 renders inline images but has no image-press event. Keep a
        named, accessible full-screen action instead of requiring a long press. */}
    {images.length ? <View className="mt-2 flex-row flex-wrap gap-2">{images.map((image) =>
      <Button key={image.fileId} variant="ghost" onPress={() => onImage(image)}>{`Open ${image.name}`}</Button>)}</View> : null}
    {assets.error || files.error || error ? <Text tone="secondary" className="text-xs">{assets.error || files.error || error}</Text> : null}
  </View>;
}

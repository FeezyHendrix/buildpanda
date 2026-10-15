import { useState } from 'react';
import { Image } from 'expo-image';
import { Modal, Pressable, View } from 'react-native';
import { contentParts, plainTextFromHtml, type ContentImage as ImageReference } from '@buildpanda/rich-content';
import { Text, type TextProps } from '@/components/atoms/text';
import { Button } from '@/components/atoms/button';
import { useContentImage, useContentImageResolver } from '@/hooks/use-content-image';
import { EnrichedContent } from './enriched-content';
import { enrichedAvailable } from './enriched-runtime';

export function ContentImage({ image, projectId }: { image: ImageReference; projectId?: string }) {
  const { url, error } = useContentImage(image.fileId, projectId);
  const [expanded, setExpanded] = useState(false);
  if (!url) return <Text tone="secondary" className="rounded-lg bg-surface-alt p-3 text-xs">{error || `Image: ${image.name}`}</Text>;
  return <View className="my-2">
    <Pressable onPress={() => setExpanded(true)} accessibilityRole="button" accessibilityLabel={`Open ${image.name}`}>
      <Image source={{ uri: url }} contentFit="contain" style={{ width: '100%', height: 220 }} accessibilityLabel={image.name} />
    </Pressable>
    <ImageModal url={url} name={image.name} visible={expanded} onClose={() => setExpanded(false)} />
  </View>;
}

export function ImageModal({ url, name, visible, onClose }: { url: string; name: string; visible: boolean; onClose: () => void }) {
  return <Modal visible={visible && !!url} onRequestClose={onClose} animationType="fade">
    <View className="flex-1 bg-surface px-4 pb-8 pt-16">
      <Image source={{ uri: url }} contentFit="contain" style={{ flex: 1 }} accessibilityLabel={name} />
      <Button variant="secondary" onPress={onClose}>Close image</Button>
    </View>
  </Modal>;
}

export function ContentText({ value, projectId, ...props }: Omit<TextProps, 'children'> & { value?: string | null; projectId?: string }) {
  const parts = contentParts(value ?? '');
  if (!parts.some((part) => part.type === 'image')) return <Text {...props}>{value}</Text>;
  return <View className="gap-1">{parts.map((part, index) => part.type === 'text' ?
    <Text key={index} {...props}>{part.text}</Text> : <ContentImage key={`${part.image.fileId}:${index}`} image={part.image} projectId={projectId} />)}</View>;
}

export function RichContent({ html, text, projectId }: { html?: string | null; text?: string | null; projectId?: string }) {
  const images = useContentImageResolver(projectId);
  const [selected, setSelected] = useState<ImageReference | null>(null);
  const fullImage = useContentImage(selected?.fileId ?? '', projectId);
  if (!html) return <ContentText value={text} projectId={projectId} />;
  if (!images.ready) return null;
  if (!enrichedAvailable) return <ContentText value={text ?? plainTextFromHtml(html)} projectId={projectId} />;
  return <><EnrichedContent key={`${images.projectId}:${images.version}`} html={html} projectId={images.projectId} onImage={setSelected} />
    <ImageModal url={fullImage.url} name={selected?.name ?? "Image"} visible={!!selected} onClose={() => setSelected(null)} /></>;
}

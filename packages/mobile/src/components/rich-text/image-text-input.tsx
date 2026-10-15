import { useRef, useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { appendImage, contentParts, removeImage, textWithImages, textWithoutImages } from '@buildpanda/rich-content';
import { useFieldSession } from '@/lib/field-session';
import { Text } from '@/components/atoms/text';
import { Button } from '@/components/atoms/button';
import { AttachmentButtons } from './attachment-buttons';
import { ContentImage } from './rich-content';

/** The same text contract as TextInput, with durable image references added. */
export function ImageTextInput({ value = '', onChangeText, editable, ...props }: TextInputProps & { className?: string }) {
  const { projectId } = useFieldSession();
  const [error, setError] = useState('');
  const latest = useRef(value);
  latest.current = value;
  const images = contentParts(value).flatMap((part) => part.type === 'image' ? [part.image] : []);
  function change(next: string) {
    if (editable === false) return;
    if (props.maxLength && next.length > props.maxLength) { setError(`This field allows ${props.maxLength} characters, including image references.`); return; }
    onChangeText?.(next);
  }
  return <View className="gap-2">
    <TextInput {...props} editable={editable} value={textWithoutImages(value)} onChangeText={(next) => change(textWithImages(next, latest.current))} />
    {images.map((image, index) => <View key={`${image.fileId}:${index}`}>
      <ContentImage image={image} projectId={projectId} />
      {editable !== false ? <Button variant="ghost" onPress={() => change(removeImage(latest.current, image.fileId))}>{`Remove ${image.name}`}</Button> : null}
    </View>)}
    {projectId && editable !== false ? <AttachmentButtons projectId={projectId} imagesOnly imageCount={images.length} onError={setError}
      onUploaded={(file) => { try { change(appendImage(latest.current, { fileId: file.id, name: file.fileName })); } catch (error) { setError(error instanceof Error ? error.message : 'Could not add image.'); } }} /> : null}
    {error ? <Text tone="danger" className="text-xs">{error}</Text> : null}
  </View>;
}

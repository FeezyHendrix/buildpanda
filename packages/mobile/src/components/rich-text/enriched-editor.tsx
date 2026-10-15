import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { EnrichedTextInput, type EnrichedTextInputInstance, type OnChangeStateEvent, type OnPasteImagesEvent } from "react-native-enriched-html";
import { embeddedImages, filePath, MAX_CONTENT_IMAGES } from "@buildpanda/rich-content";
import { contentWork } from "@buildpanda/rich-content/pending";
import { Text } from "@/components/atoms/text";
import { useKeyboardReveal } from "@/hooks/use-keyboard-avoidance";
import { stageContentImage } from "@/lib/content-images";
import { requireAccess, requireCurrentAccess } from "@/lib/project-access-store";
import { uploadAccess } from "@/lib/feature-access";
import { palette } from "@/constants/colors";
import { AttachmentButtons } from "./attachment-buttons";
import { EnrichedToolbar } from "./enriched-toolbar";
import { EnrichedLinkForm } from "./enriched-link-form";
import { richTextDocument } from "./html-document";
import { useEditorImages } from "./use-editor-images";
import { useEditorAccessibility } from "./use-editor-accessibility";
import { enrichedHtmlStyle, enrichedSanitization, enrichedStyles } from "./enriched-theme";

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  label?: string;
  projectId?: string;
  compact?: boolean;
  editable?: boolean;
}

/** One native editor contract for all forms and voice-review fields. */
export function EnrichedEditor({ value, onChange, placeholder = "Write here…", label, projectId, compact = false, editable = true }: RichTextEditorProps) {
  const editor = useRef<EnrichedTextInputInstance>(null);
  const container = useRef<View>(null);
  useEditorAccessibility(container, label ?? placeholder);
  const selection = useRef({ start: 0, end: 0, text: "" });
  const reveal = useKeyboardReveal();
  const assets = useEditorImages(value, projectId);
  const [state, setState] = useState<OnChangeStateEvent>();
  const [error, setError] = useState("");
  const [link, setLink] = useState<typeof selection.current>();
  const display = richTextDocument(value, assets.images, true);
  const initial = useRef(display);
  const rendered = useRef(display);
  const latest = useRef(value);
  latest.current = value;
  const enabled = useRef(editable);
  enabled.current = editable;
  const mounted = useRef(true);
  const resetting = useRef(false);

  useEffect(() => {
    if (display === rendered.current) return;
    rendered.current = display;
    resetting.current = true;
    editor.current?.setValue(display);
    editor.current?.setSelection(selection.current.start, selection.current.end);
    // Read after the ordered native commands so hydration is not an edit.
    void editor.current?.getHTML().catch(() => undefined).finally(() => { resetting.current = false; });
  }, [display]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function attach(file: { id: string; fileName: string; mimeType: string }) {
    if (!enabled.current || !projectId) return;
    const finish = contentWork.begin();
    try {
    const ticket = requireAccess(projectId, uploadAccess);
    const end = selection.current.end;
    if (file.mimeType.startsWith("image/")) {
      const image = await assets.resolve({ fileId: file.id, name: file.fileName });
      requireCurrentAccess(ticket);
      if (!mounted.current || !enabled.current) return;
      editor.current?.setSelection(end, end);
      editor.current?.setImage(image.source, image.width, image.height);
    } else {
      editor.current?.setLink(end, end, file.fileName, filePath(file.id));
    }
    const html = await editor.current?.getHTML();
    requireCurrentAccess(ticket);
    if (html !== undefined && mounted.current && enabled.current) publish(html);
    } finally { finish(); }
  }

  function publish(raw: string) {
    const html = richTextDocument(raw, assets.current.current);
    rendered.current = richTextDocument(html, assets.current.current, true);
    latest.current = html;
    onChange(html);
  }

  async function paste(images: OnPasteImagesEvent["images"]) {
    const finish = contentWork.begin();
    try {
      if (!projectId || !enabled.current) return;
      const ticket = requireAccess(projectId, uploadAccess);
      if (embeddedImages(latest.current).length + images.length > MAX_CONTENT_IMAGES) throw new Error(`Add up to ${MAX_CONTENT_IMAGES} images per field.`);
      for (const image of images) {
        requireCurrentAccess(ticket);
        const staged = await stageContentImage(projectId, { uri: image.uri, fileName: `Pasted image.${image.type.split("/")[1] || "png"}`, mimeType: image.type });
        await attach({ id: staged.fileId, fileName: staged.name, mimeType: image.type });
      }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not paste this image."); }
    finally {
      finish();
      if (Platform.OS === "web") for (const image of images) if (image.uri.startsWith("blob:")) URL.revokeObjectURL(image.uri);
    }
  }

  return <View ref={container} className="overflow-hidden rounded-xl border border-hairline bg-surface">
    {editable ? <EnrichedToolbar editor={editor} state={state} onLink={() => setLink({ ...selection.current })} /> : null}
    {editable && link ? <EnrichedLinkForm text={link.text} onCancel={() => setLink(undefined)} onApply={(text, url) => {
      if (enabled.current) editor.current?.setLink(link.start, link.end, text, url);
      setLink(undefined);
    }} /> : null}
    <EnrichedTextInput ref={editor} defaultValue={initial.current} editable={editable}
      accessibilityLabel={label ?? placeholder} placeholder={placeholder} placeholderTextColor={palette.grey200}
      cursorColor={palette.primary500} selectionColor={palette.primary500} htmlStyle={enrichedHtmlStyle}
      sanitizationConfig={enrichedSanitization} style={StyleSheet.flatten([enrichedStyles.text, enrichedStyles.editor, compact && enrichedStyles.compact])}
      scrollEnabled={compact} onFocus={() => reveal?.(container.current ?? undefined)}
      onChangeSelection={(event) => { selection.current = event.nativeEvent; }}
      onChangeState={(event) => setState(event.nativeEvent)}
      onChangeHtml={(event) => {
        if (!enabled.current || resetting.current) return;
        publish(event.nativeEvent.value);
      }}
      onPasteImages={(event) => { void paste(event.nativeEvent.images); }} />
    {editable && projectId ? <AttachmentButtons projectId={projectId} imageCount={embeddedImages(value).length} onError={setError}
      onUploaded={(file) => { void attach(file).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not insert the attachment.")); }} /> : null}
    {error || assets.error ? <Text tone="danger" className="px-3 py-2 text-xs">{error || assets.error}</Text> : null}
  </View>;
}

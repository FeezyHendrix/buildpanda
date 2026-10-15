import { useState } from "react";
import { embeddedImages } from "@buildpanda/rich-content";
import { View } from "react-native";
import { Text } from "@/components/atoms";
import { useContentImageResolver } from "@/hooks/use-content-image";
import { useContentFileOpener } from "@/hooks/use-content-file-opener";
import type { EditorAttachment } from "./html-sync-plugin";
import { AttachmentButtons } from "./attachment-buttons";
import Editor from "./editor.dom";

/**
 * Rich-text field shared by the authoring surfaces (RFI responses, daily-log
 * entries, change-request descriptions). The editor itself is a Lexical instance
 * running as an Expo DOM component (a WebView); this wrapper is the React Native
 * seam, exposing a plain `value`/`onChange` HTML contract so callers never touch
 * the DOM bridge.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  label,
  projectId,
  compact = false,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  label?: string;
  projectId?: string;
  /** Caps the height so a composer in a page footer leaves room above the keyboard. */
  compact?: boolean;
}) {
  const [error, setError] = useState("");
  const [attachment, setAttachment] = useState<EditorAttachment>();
  const images = useContentImageResolver(projectId);
  const files = useContentFileOpener(projectId);

  return (
    <View className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <Editor label={label} value={value} onChangeHtml={onChange} placeholder={placeholder} compact={compact}
        attachment={attachment} resolveImage={images.resolve} accessVersion={images.version} onOpenFile={files.open} dom={{ matchContents: true }} />
      {images.projectId ? (
        <AttachmentButtons
          projectId={images.projectId}
          imageCount={embeddedImages(value).length}
          onError={setError}
          onUploaded={(file) => setAttachment({ key: `${file.id}:${Date.now()}`, fileId: file.id, fileName: file.fileName, mimeType: file.mimeType })}
        />
      ) : null}
      {error || files.error ? (
        <View className="border-t border-hairline bg-error-50 px-3 py-2">
          <Text tone="danger" className="text-xs">
            {error || files.error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

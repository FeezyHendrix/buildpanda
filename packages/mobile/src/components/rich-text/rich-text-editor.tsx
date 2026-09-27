import { useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/atoms";
import { appendHtmlAttachment } from "@/lib/html";
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
  projectId,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  projectId?: string;
}) {
  const [error, setError] = useState("");

  return (
    <View className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <Editor value={value} onChangeHtml={onChange} placeholder={placeholder} dom={{ matchContents: true }} />
      {projectId ? (
        <AttachmentButtons
          projectId={projectId}
          onError={setError}
          onUploaded={(file) => onChange(appendHtmlAttachment(value, { fileId: file.id, fileName: file.fileName, mimeType: file.mimeType }))}
        />
      ) : null}
      {error ? (
        <View className="border-t border-hairline bg-error-50 px-3 py-2">
          <Text tone="danger" className="text-xs">
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

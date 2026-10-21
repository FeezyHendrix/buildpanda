import type { DocumentPreviewProps } from "./document-preview";

/**
 * The browser's own file viewer.
 *
 * react-native-webview ships android, ios, macos and windows builds and no web
 * one, so on web it rendered a native component the DOM has no element for:
 * a blank pane that never fired onError, leaving the retry fallback unreachable.
 * An iframe is what WebView wraps on every other platform anyway.
 */
export function DocumentPreview({ uri, attempt, onError }: DocumentPreviewProps) {
  return (
    <iframe
      key={`${uri}:${attempt}`}
      src={uri}
      title="Document preview"
      onError={onError}
      // The file comes from this origin's own cache; scripts in a previewed
      // document have no reason to run, matching javaScriptEnabled={false}.
      sandbox=""
      style={{ flex: 1, width: "100%", height: "100%", border: "none" }}
    />
  );
}

import { WebView } from "react-native-webview";
import { Spinner } from "@/components/atoms";
import { documentCacheDirUri } from "@/lib/download-file";

export interface DocumentPreviewProps {
  uri: string;
  /** Changes to force a fresh load after a retry. */
  attempt: number;
  onError: () => void;
}

/** Anything that is not a PDF or an image: the platform's own file viewer. */
export function DocumentPreview({ uri, attempt, onError }: DocumentPreviewProps) {
  return (
    <WebView
      key={`${uri}:${attempt}`} source={{ uri }} style={{ flex: 1 }}
      originWhitelist={["file://*"]} javaScriptEnabled={false} allowFileAccess allowingReadAccessToURL={documentCacheDirUri(uri)}
      onShouldStartLoadWithRequest={(request) => request.url === uri || request.url === "about:blank"}
      startInLoadingState renderLoading={() => <Spinner />}
      onError={onError} onHttpError={onError}
    />
  );
}

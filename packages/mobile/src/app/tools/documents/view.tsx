import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import { WebView } from "react-native-webview";
import { Button, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import SheetCanvas from "@/components/plan-review/sheet-canvas.dom";
import { SHEET_TOOL } from "@/components/plan-review/markup-types";
import { SheetPager } from "@/components/plan-review/sheet-controls";
import { documentCacheDirUri } from "@/lib/download-file";
import { palette } from "@/constants/colors";
import { goBack } from "@/lib/navigation";

const ignore = async () => {};

/** Uses the plan renderer for PDFs, including offline files on Android. */
function PdfViewer({ uri }: { uri: string }) {
  const [bytes, setBytes] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pageNo, setPageNo] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  useEffect(() => {
    let cancelled = false;
    setBytes(null);
    setError(null);
    readAsStringAsync(uri, { encoding: EncodingType.Base64 }).then((value) => {
      if (!cancelled) setBytes(value);
    }).catch(() => {
      if (!cancelled) setError("This saved file could not be opened. Download it again when you have signal.");
    });
    return () => { cancelled = true; };
  }, [uri, attempt]);

  if (error) return <View className="gap-4 py-8"><Text tone="danger">{error}</Text><Button onPress={() => setAttempt((value) => value + 1)}>Try again</Button></View>;
  if (!bytes) return <View className="flex-1 items-center justify-center"><Spinner /></View>;
  return (
    <View className="relative flex-1 overflow-hidden rounded-xl">
      <SheetCanvas
        docKey={uri} pdfBase64={bytes} imageDataUri={null} pageNo={pageNo}
        markups={[]} selectedId={null} tool={SHEET_TOOL.PAN} color={palette.primary500}
        metresPerPct={null} fitNonce={0} draftPin={null}
        onCreate={ignore} onTapPoint={ignore} onSelect={ignore} onZoom={ignore}
        onRendered={async (info) => setPageCount(info.pageCount)}
        dom={{ style: { flex: 1 } }}
      />
      <SheetPager pageNo={pageNo} pageCount={pageCount} onChangePage={setPageNo} />
    </View>
  );
}

export default function DocumentViewer() {
  const { uri, name } = useLocalSearchParams<{ uri: string; name?: string }>();
  const [webError, setWebError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const isPdf = /\.pdf(?:$|[?#])/i.test(name || uri || "");
  const isImage = /\.(png|jpe?g|gif|webp|heic|bmp)(?:$|[?#])/i.test(name || uri || "");

  return (
    <Page title={name || "Document"} onBack={goBack} scroll={false} showSync={false}>
      {!uri ? (
        <View className="items-center py-12"><Text tone="secondary">This file isn&apos;t available offline yet.</Text></View>
      ) : isPdf ? <PdfViewer key={uri} uri={uri} /> : webError ? (
        <View className="gap-4 py-8">
          <Text tone="danger">This file could not be previewed on this device.</Text>
          <Button onPress={() => { setWebError(false); setAttempt((value) => value + 1); }}>Try again</Button>
        </View>
      ) : isImage ? (
        <Image key={`${uri}:${attempt}`} source={{ uri }} contentFit="contain" style={{ flex: 1 }} onError={() => setWebError(true)} />
      ) : (
        <WebView
          key={`${uri}:${attempt}`} source={{ uri }} style={{ flex: 1 }}
          originWhitelist={["*"]} allowFileAccess allowingReadAccessToURL={documentCacheDirUri()}
          startInLoadingState renderLoading={() => <Spinner />}
          onError={() => setWebError(true)} onHttpError={() => setWebError(true)}
        />
      )}
    </Page>
  );
}

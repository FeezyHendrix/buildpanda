import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { documentCacheDirUri } from "@/lib/download-file";

export default function DocumentViewer() {
  const { uri, name } = useLocalSearchParams<{ uri: string; name?: string }>();

  return (
    <Page title={name || "Document"} onBack={() => router.back()} scroll={false} showSync={false}>
      {uri ? (
        <WebView
          source={{ uri }}
          style={{ flex: 1 }}
          originWhitelist={["*"]}
          allowFileAccess
          allowingReadAccessToURL={documentCacheDirUri()}
        />
      ) : (
        <View className="items-center py-12">
          <Text tone="secondary" className="text-[13px]">
            This file isn't available offline yet.
          </Text>
        </View>
      )}
    </Page>
  );
}

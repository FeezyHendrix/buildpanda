import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/atoms/button";
import { Field } from "@/components/atoms/input";
import { safeRichTextLink } from "./html-document";

export function EnrichedLinkForm({ text, onApply, onCancel }: { text: string; onApply: (text: string, url: string) => void; onCancel: () => void }) {
  const [label, setLabel] = useState(text);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  return <View className="gap-3 border-b border-hairline p-3">
    <Field label="Link text" value={label} onChangeText={setLabel} />
    <Field label="Link address" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" placeholder="https://" error={error} />
    <View className="flex-row gap-2">
      <Button variant="secondary" onPress={onCancel}>Cancel</Button>
      <Button onPress={() => {
        const address = url.trim();
        if (!safeRichTextLink(address)) { setError("Enter an https://, http://, mailto: or tel: address."); return; }
        onApply(label.trim() || address, address);
      }}>Insert link</Button>
    </View>
  </View>;
}

import type { RefObject } from "react";
import { Pressable, View } from "react-native";
import type { EnrichedTextInputInstance, OnChangeStateEvent } from "react-native-enriched-html";
import { Text } from "@/components/atoms/text";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { label: "Bold", text: "B", state: "bold", command: "toggleBold" },
  { label: "Italic", text: "I", state: "italic", command: "toggleItalic" },
  { label: "Underline", text: "U", state: "underline", command: "toggleUnderline" },
  { label: "Bullet list", text: "• List", state: "unorderedList", command: "toggleUnorderedList" },
  { label: "Numbered list", text: "1. List", state: "orderedList", command: "toggleOrderedList" },
  { label: "Quote", text: "“ ”", state: "blockQuote", command: "toggleBlockQuote" },
] as const;

export function EnrichedToolbar({ editor, state, onLink }: {
  editor: RefObject<EnrichedTextInputInstance | null>;
  state: OnChangeStateEvent | undefined;
  onLink: () => void;
}) {
  return <View className="flex-row flex-wrap gap-1 border-b border-hairline p-2">
    {ACTIONS.map((action) => {
      const active = state?.[action.state].isActive ?? false;
      const blocked = state?.[action.state].isBlocking ?? false;
      return <Pressable key={action.command} accessibilityRole="button" accessibilityLabel={action.label}
        accessibilityState={{ selected: active, disabled: blocked }} disabled={blocked}
        onPress={() => editor.current?.[action.command]()}
        className={cn("min-h-11 min-w-11 items-center justify-center rounded-lg px-2", active ? "bg-primary-50" : "bg-surface-alt", blocked && "opacity-40")}>
        <Text weight={action.state === "bold" ? "bold" : "medium"} tone={active ? "brand" : "default"}>{action.text}</Text>
      </Pressable>;
    })}
    <Pressable accessibilityRole="button" accessibilityLabel="Insert link" onPress={onLink}
      className="min-h-11 min-w-11 items-center justify-center rounded-lg bg-surface-alt px-2">
      <Text weight="medium">Link</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss keyboard" onPress={() => editor.current?.blur()}
      className="min-h-11 items-center justify-center rounded-lg px-2">
      <Text tone="brand" weight="semibold">Done</Text>
    </Pressable>
  </View>;
}

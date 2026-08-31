import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import type { ChatMessage } from "@/api/panda-ai";
import { usePandaAiChat } from "@/hooks/use-panda-ai-chat";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "What's the project status?",
  "Show me overdue activities",
  "Summarise today's daily log",
  "Any open RFIs?",
];

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <View className={cn("mb-3 max-w-[85%] rounded-2xl px-4 py-3", isUser ? "self-end bg-primary-500" : "self-start bg-surface-alt")}>
      <Text tone={isUser ? "inverse" : "default"} className="text-[15px]">
        {message.content || "…"}
      </Text>
    </View>
  );
}

export default function PandaAiChat() {
  const { projectId } = useFieldSession();
  const { isOnline } = useSyncState();
  const { messages, streaming, activeTool, error, send, stop, reset } = usePandaAiChat(projectId);
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList>(null);

  function handleSend() {
    if (!input.trim() || streaming) return;
    send(input.trim());
    setInput("");
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <Page title="Panda AI" onBack={() => router.back()} showSync={false} scroll={false}>
      {!isOnline ? (
        <View className="items-center py-4">
          <Text tone="secondary" className="text-[13px]">Panda AI needs a connection to work.</Text>
        </View>
      ) : null}

      {messages.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="sparkles-outline" size={40} color="#004DE7" />
          <Text weight="bold" className="pt-4 text-lg">Ask Panda AI</Text>
          <Text tone="secondary" className="pt-1 text-center text-[13px]">
            Ask about your project — activities, delays, RFIs, budget, anything in BuildPanda.
          </Text>
          <View className="mt-6 flex-row flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => { send(s); }}
                className="rounded-full border border-hairline bg-surface px-4 py-2 active:bg-surface-alt"
              >
                <Text weight="medium" tone="brand" className="text-[13px]">{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerClassName="px-4 py-4"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {activeTool ? (
        <View className="flex-row items-center gap-2 px-4 py-2">
          <Spinner size="xs" />
          <Text tone="secondary" className="text-xs">Using {activeTool}…</Text>
        </View>
      ) : null}

      {error ? (
        <View className="px-4 pb-2">
          <Text tone="danger" className="text-xs">{error}</Text>
        </View>
      ) : null}

      <View className="flex-row items-end gap-2 border-t border-hairline bg-surface px-4 py-3">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask Panda AI…"
          placeholderTextColor="#ADADAD"
          multiline
          returnKeyType="send"
          onSubmitEditing={handleSend}
          className="max-h-28 min-h-12 flex-1 rounded-xl bg-surface-alt px-4 py-3 font-jakarta text-base text-black-500"
        />
        <Pressable
          onPress={streaming ? stop : handleSend}
          disabled={!streaming && !input.trim()}
          accessibilityRole="button"
          accessibilityLabel={streaming ? "Stop" : "Send"}
          className={cn(
            "h-12 w-12 items-center justify-center rounded-xl bg-primary-500",
            !streaming && !input.trim() && "opacity-50",
          )}
        >
          {streaming ? (
            <Ionicons name="stop" size={18} color="#FFFFFF" />
          ) : (
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </Page>
  );
}

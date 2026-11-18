import { ContentText } from "@/components/rich-text/rich-content";
import { withProjectPermission } from "@/components/molecules/permission-gate";
import { goBack } from "@/lib/navigation";
import Ionicons from "@/components/atoms/icon";
import { useEffect, useRef, useState } from "react";
import { FlatList, Keyboard, TextInput } from "@/platform/browser";
import { Spinner, Text } from "@/components/atoms";
import { ICON_BRAND, ICON_INVERSE, ICON_SUBTLE } from "@/constants/colors";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
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
/** An assistant turn with nothing in it yet is a reply being composed, so it shows as one. */
function MessageBubble({ message }: {
    message: ChatMessage;
}) {
    const isUser = message.role === "user";
    return (<div className={"field-stack " + (cn("mb-3 max-w-[85%] rounded-2xl px-4 py-3", isUser ? "self-end bg-primary-500" : "self-start bg-surface-alt"))}>
      {message.content ? (<ContentText tone={isUser ? "inverse" : "default"} className="text-[15px]" value={message.content}/>) : (<div aria-label="Panda AI is typing" className="field-stack min-h-5 justify-center">
          <Spinner size="xs"/>
        </div>)}
    </div>);
}
function PandaAiChat() {
    const { projectId } = useFieldSession();
    const { isOnline } = useSyncState();
    const { messages, streaming, activeTool, error, send, stop, reset } = usePandaAiChat(projectId);
    const [input, setInput] = useState("");
    const listRef = useRef<FlatList>(null);
    // the keyboard shrinks the list from below; keep the newest message in view
    function handleSend() {
        if (!input.trim() || streaming)
            return;
        send(input.trim());
        setInput("");
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
    return (<Page title="Panda AI" onBack={() => goBack()} showSync={false}
    // A fresh thread: the history is what Panda AI answers against, so
    // starting over is the only way to ask about something unrelated.
    rightButtons={messages.length > 0 ? (<HeaderIconButton icon="add-circle-outline" label="New chat" onPress={reset}/>) : null} scroll={false} footer={<div className="field-stack gap-2">
          {error ? (<Text tone="danger" className="px-1 text-xs">
              {error}
            </Text>) : null}
          <div className="field-stack flex-row items-end gap-2">
            <TextInput value={input} onChangeText={setInput} placeholder="Ask Panda AI…" placeholderTextColor={ICON_SUBTLE} multiline returnKeyType="send" onSubmitEditing={handleSend} className="max-h-28 min-h-14 flex-1 rounded-xl bg-surface-alt px-4 py-3 font-inter text-base text-black-500"/>
            <button onClick={streaming ? stop : handleSend} disabled={!streaming && !input.trim()} role="button" aria-label={streaming ? "Stop" : "Send"} className={cn("h-14 w-14 items-center justify-center rounded-xl bg-primary-500", !streaming && !input.trim() && "opacity-50")} type="button">
              {streaming ? (<Ionicons name="stop" size={18} color={ICON_INVERSE}/>) : (<Ionicons name="arrow-up" size={20} color={ICON_INVERSE}/>)}
            </button>
          </div>
        </div>}>
      {!isOnline ? (<div className="field-stack items-center py-4">
          <Text tone="secondary" className="text-[13px]">Panda AI needs a connection to work.</Text>
        </div>) : null}

      {messages.length === 0 ? (<div className="field-stack flex-1 items-center justify-center px-6">
          <Ionicons name="sparkles-outline" size={40} color={ICON_BRAND}/>
          <Text weight="bold" className="pt-4 text-lg">Ask Panda AI</Text>
          <Text tone="secondary" className="pt-1 text-center text-[13px]">
            Ask about your project — activities, delays, RFIs, budget, anything in BuildPanda.
          </Text>
          <div className="field-stack mt-6 flex-row flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (<button key={s} onClick={() => { send(s); }} role="button" className="min-h-11 justify-center rounded-full border border-hairline bg-surface px-4 active:bg-surface-alt" type="button">
                <Text weight="medium" tone="brand" className="text-[13px]">{s}</Text>
              </button>))}
          </div>
        </div>) : (<FlatList ref={listRef} data={messages} keyExtractor={(_, i) => String(i)} renderItem={({ item }) => <MessageBubble message={item}/>} contentContainerClassName="px-4 py-4" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}/>)}

      {activeTool ? (<div className="field-stack flex-row items-center gap-2 px-4 py-2">
          <Spinner size="xs"/>
          <Text tone="secondary" className="text-xs">Using {activeTool}…</Text>
        </div>) : null}
    </Page>);
}
export default withProjectPermission(PandaAiChat, "/tools/panda-ai");

import { useEffect, useRef } from "react";
import { useThread } from "@/hooks/use-chat";
import { XIcon } from "@/components/atoms/chat-icons";
import { MessageGroup } from "./message-group";
import { Composer } from "./composer";
import type { ChatMessage } from "@/lib/project-types";

export function ThreadPanel({
  rootMessage,
  projectId,
  currentUserId,
  onClose,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onReaction,
  pinnedIds,
}: {
  rootMessage: ChatMessage;
  projectId: string;
  currentUserId: string;
  onClose: () => void;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onPin: (m: ChatMessage) => void;
  onUnpin: (m: ChatMessage) => void;
  onReaction: (m: ChatMessage, emoji: string) => void;
  pinnedIds: Set<string>;
}) {
  const { data: thread = [] } = useThread(rootMessage.id);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  return (
    <div className="relative z-10 flex w-full lg:w-[420px] shrink-0 flex-col border-l border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h3 className="text-[15px] font-semibold text-black-900">Thread</h3>
        <button onClick={onClose} className="text-gray-500 transition-colors hover:text-gray-800" aria-label="Close thread">
          <XIcon />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-3">
        <div className="bg-gray-50/70">
          <MessageGroup
            messages={[rootMessage]}
            currentUserId={currentUserId}
            pinnedIds={pinnedIds}
            onEdit={onEdit}
            onDelete={onDelete}
            onPin={onPin}
            onUnpin={onUnpin}
            onReply={() => {}}
            onReaction={onReaction}
          />
        </div>

        {thread.map((m: ChatMessage) => (
          <MessageGroup
            key={m.id}
            messages={[m]}
            currentUserId={currentUserId}
            pinnedIds={pinnedIds}
            onEdit={onEdit}
            onDelete={onDelete}
            onPin={onPin}
            onUnpin={onUnpin}
            onReply={() => {}}
            onReaction={onReaction}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-gray-200 px-5 py-4">
        <Composer channelId={rootMessage.channelId} projectId={projectId} parentMessageId={rootMessage.id} isThread />
      </div>
    </div>
  );
}

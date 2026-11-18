import { ContentText } from "@/components/rich-text/rich-content";
import Ionicons from "@/components/atoms/icon";
import { memo, useState } from "react";
import { Linking } from "@/platform/browser";
import type { Message } from "@/api/messaging";
import { Spinner, Text } from "@/components/atoms";
import { ICON_BRAND } from "@/constants/colors";
import { API_BASE_URL } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
const timeFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
function Attachment({ file }: {
    file: Message["attachments"][number];
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function open() {
        setBusy(true);
        setError("");
        try {
            {
                await Linking.openURL(`${API_BASE_URL}/files/${encodeURIComponent(file.fileId)}/download`);
            }
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn’t open this attachment.");
        }
        finally {
            setBusy(false);
        }
    }
    return <div className="field-stack"><button role="button" aria-label={`Open attachment ${file.name}`} disabled={busy} onClick={() => { void open(); }} className="mt-2 min-h-11 flex-row items-center gap-2 rounded-lg border border-primary-100 bg-surface px-3 py-2" type="button">
    {busy ? <Spinner size="xs"/> : <Ionicons name="attach-outline" size={18} color={ICON_BRAND}/>}<Text tone="brand" className="shrink text-sm">{file.name}</Text>
  </button>{error ? <Text tone="danger" className="pt-1 text-xs">{error}</Text> : null}</div>;
}
export const MessageBubble = memo(function MessageBubble({ message, ownerId, onReply }: {
    message: Message;
    ownerId: string | undefined;
    onReply?: (message: Message) => void;
}) {
    const mine = message.authorId === ownerId;
    return (<div className={"field-stack " + (cn("mb-4 max-w-[92%]", mine ? "self-end" : "self-start"))}>
      <Text tone="secondary" weight="medium" className={cn("pb-1 text-xs", mine && "text-right")}>{mine ? "You" : message.authorName || "Teammate"}</Text>
      <div className={"field-stack " + (cn("rounded-2xl border px-4 py-3", mine ? "rounded-br-sm border-primary-100 bg-primary-50" : "rounded-bl-sm border-line bg-surface"))}>
        {message.deletedAt ? <Text tone="secondary" className="text-sm italic">Message deleted</Text> : <>
          {message.quotedMessage ? <div className="field-stack mb-2 border-l-2 border-primary-500 pl-3"><Text weight="semibold" className="text-xs">{message.quotedMessage.authorName || "Teammate"}</Text><Text tone="secondary" numberOfLines={3} className="pt-1 text-xs">{message.quotedMessage.deleted ? "Message deleted" : message.quotedMessage.body}</Text></div> : null}
          {message.body ? <ContentText selectable className="text-base leading-6" value={message.body}/> : null}
          {(message.attachments ?? []).map((file) => <Attachment key={file.fileId} file={file}/>)}
          {message.resolvedReferences?.map((reference) => <Text key={`${reference.type}:${reference.id}`} tone="secondary" className="pt-2 text-xs">{reference.restricted ? "Restricted project record" : reference.title || "Project record"}</Text>)}
          {message.reactions?.length ? <div className="field-stack mt-2 flex-row flex-wrap gap-2">{message.reactions.map((reaction) => <div key={reaction.emoji} className="field-stack rounded-full border border-line bg-surface px-2 py-1"><Text className="text-xs">{reaction.emoji} {reaction.count}</Text></div>)}</div> : null}
        </>}
        <Text tone="secondary" className="pt-2 text-[10px]">{timeFormatter.format(new Date(message.createdAt))}{message.editedAt ? " · Edited" : ""}{mine && message.readAt ? " · Read" : ""}</Text>
      </div>
      {onReply ? <button role="button" aria-label={`Reply to ${message.authorName || "message"}`} onClick={() => onReply(message)} className="min-h-11 justify-center self-start px-2" type="button"><Text tone="brand" weight="medium" className="text-xs">{message.replyCount ? `${message.replyCount} ${message.replyCount === 1 ? "reply" : "replies"}` : "Reply"}</Text></button> : null}
    </div>);
});

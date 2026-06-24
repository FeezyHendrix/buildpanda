import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/lib/toast";
import { uploadFileRequest } from "@/hooks/use-files";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useProjectChannels,
  useChannelMessages,
  useChannelMembers,
  useSendMessage,
  useEditMessage,
  useDeleteMessage,
  useMarkChannelRead,
  useReferenceSearch,
  useToggleReaction,
  usePins,
  usePinMessage,
  useUnpinMessage,
  useThread,
  useOpenDm,
  useAllChannels,
  useUpdateMembership,
  useMessageSearch,
  useForwardToActionItem,
} from "@/hooks/use-chat";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { formatTimeAgo } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useChannelRealtime } from "@/lib/realtime";
import {
  cacheMessages,
  clearCachedDraft,
  readCachedDraft,
  readCachedMessages,
  saveCachedDraft,
} from "@/lib/chat-cache";
import type { Channel, ChatMessage, ChannelMemberLite } from "@/lib/project-types";
import {
  AtSignIcon,
  BellIcon,
  BellOffIcon,
  BoldIcon,
  CodeIcon,
  FileTextIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  PlusCircleIcon,
  PlusIcon,
  ReplyIcon,
  SearchIcon,
  SendIcon,
  SmileIcon,
  StarIcon,
  XIcon,
} from "@/components/atoms/chat-icons";

function chatFileUrl(fileId: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || "/api";
  return `${base}/files/${fileId}/download`;
}

function ChannelRow({
  channel,
  isActive,
  onClick,
}: {
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
        isActive
          ? "bg-primary-50 text-primary-500"
          : "text-gray-700 hover:bg-gray-100",
        channel.muted && !isActive && "text-gray-400"
      )}
    >
      <span className="text-gray-400">#</span>
      <span className="flex-1 truncate">{channel.name || "general"}</span>
      {channel.unreadCount > 0 && (
        <span className="flex h-5 items-center justify-center rounded-full bg-primary-500 px-2 text-[10px] font-bold text-white">
          {channel.unreadCount}
        </span>
      )}
    </button>
  );
}

function ReferenceChip({ refItem }: { refItem: NonNullable<ChatMessage["resolvedReferences"]>[0] }) {
  if (refItem.restricted) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-400">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Restricted item
      </div>
    );
  }

  const typeLabels: Record<string, string> = {
    rfi: "RFI",
    action_item: "Action item",
    query: "Query",
    change_request: "Change request",
    activity: "Activity",
  };

  const label = typeLabels[refItem.type] || refItem.type;

  return (
    <Link to={refItem.url!} className="inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs transition-shadow hover:shadow-sm">
      <span className="font-medium text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900">{refItem.title}</span>
      {refItem.status && (
        <Badge variant="outline" className="text-[10px] leading-none py-0.5 px-1.5">{refItem.status}</Badge>
      )}
    </Link>
  );
}

function AttachmentChip({ attachment }: { attachment: NonNullable<ChatMessage["attachments"]>[0] }) {
  const isImage = (attachment.mime ?? "").startsWith("image/");
  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-h-48 max-w-xs rounded-lg border border-gray-200 object-cover"
        />
      </a>
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex w-fit items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-700 transition-colors hover:bg-gray-100"
    >
      <span className="flex size-9 items-center justify-center rounded-md bg-white text-gray-500 ring-1 ring-gray-200">
        <FileTextIcon />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="max-w-[220px] truncate text-sm font-semibold text-gray-800">{attachment.name}</span>
        {attachment.size && (
          <span className="text-xs text-gray-500">{Math.max(1, Math.round(attachment.size / 1024))} KB</span>
        )}
      </span>
    </a>
  );
}

function ReferencePicker({
  onSelect,
  onClose,
}: {
  onSelect: (ref: { type: string; id: string; label: string }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useReferenceSearch(debouncedQuery);

  const typeLabels: Record<string, string> = {
    rfi: "RFI",
    action_item: "Action item",
    query: "Query",
    change_request: "Change request",
    activity: "Activity",
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden flex flex-col z-10">
      <div className="p-2 border-b border-gray-100">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entities..."
          className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30"
        />
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {debouncedQuery.length < 2 ? (
          <div className="p-2 text-center text-xs text-gray-500">Type 2+ chars to search</div>
        ) : isLoading ? (
          <div className="p-2 text-center text-xs text-gray-500">Loading...</div>
        ) : !results?.length ? (
          <div className="p-2 text-center text-xs text-gray-500">No results found</div>
        ) : (
          results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              type="button"
              onClick={() => {
                onSelect({ type: r.type, id: r.id, label: r.label });
                onClose();
              }}
              className="w-full flex items-center justify-between rounded-md px-3 py-2 text-left hover:bg-gray-50"
            >
              <span className="truncate text-sm font-medium text-gray-900">{r.label}</span>
              <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wider text-gray-500">{typeLabels[r.type] || r.type}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}




function MessageItem({
  message,
  isOwn,
  isPinned,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onReply,
  onReaction,
  onForward,
}: {
  message: ChatMessage;
  isOwn: boolean;
  isPinned: boolean;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onPin: (m: ChatMessage) => void;
  onUnpin: (m: ChatMessage) => void;
  onReply: (m: ChatMessage) => void;
  onReaction: (m: ChatMessage, emoji: string) => void;
  onForward?: (m: ChatMessage) => void;
}) {
  const [showEmoji, setShowEmoji] = useState(false);

  if (message.deletedAt) {
    return (
      <div className="py-1 text-sm italic text-gray-400">
        This message was deleted
      </div>
    );
  }

  return (
    <div className="group relative py-0.5">
      <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-gray-700">
        {message.body}
        {message.editedAt && (
          <span className="ml-2 text-[10px] text-gray-400">(edited)</span>
        )}
      </div>

      {message.resolvedReferences && message.resolvedReferences.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {message.resolvedReferences.map((ref) => (
            <ReferenceChip key={`${ref.type}-${ref.id}`} refItem={ref} />
          ))}
        </div>
      )}

      {message.attachments && message.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {message.attachments.map((a) => (
            <AttachmentChip key={a.fileId} attachment={a} />
          ))}
        </div>
      )}

      {message.reactions && message.reactions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {message.reactions.map((r) => (
            <button
              key={r.emoji}
              onClick={() => onReaction(message, r.emoji)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-colors",
                r.mine ? "border-primary-200 bg-primary-50 text-primary-500" : "border-gray-200 bg-gray-50 text-gray-600 hover:border-primary-200"
              )}
            >
              <span>{r.emoji}</span>
              <span className="text-xs font-medium">{r.count}</span>
            </button>
          ))}
        </div>
      )}

      {(message.replyCount ?? 0) > 0 && (
        <div className="mt-1">
          <button 
            onClick={() => onReply(message)} 
            className="inline-flex items-center gap-1.5 rounded-lg border-l-4 border-primary-500 bg-gray-50 px-3 py-2 text-left text-xs font-medium text-primary-500 transition-colors hover:bg-gray-100"
          >
            <ReplyIcon className="size-4" />
            {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
          </button>
        </div>
      )}

      <div className="absolute right-4 -top-2 hidden items-center gap-1 rounded-md border border-gray-200 bg-white p-1 shadow-sm group-hover:flex z-10">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmoji(!showEmoji)}
            className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            title="React"
          >
            😀
          </button>
          {showEmoji && (
            <div className="absolute right-0 bottom-full mb-1 flex gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-md">
              {["👍", "❤️", "😄", "🎉", "👀", "✅"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => { onReaction(message, emoji); setShowEmoji(false); }}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-sm hover:bg-gray-100"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <button
          type="button"
          onClick={() => onReply(message)}
          className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          Reply
        </button>

        <button
          type="button"
          onClick={() => onForward?.(message)}
          className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          → Task
        </button>

        {isPinned ? (
          <button
            type="button"
            onClick={() => onUnpin(message)}
            className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            Unpin
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onPin(message)}
            className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            Pin
          </button>
        )}

        {isOwn && (
          <>
            <button
              type="button"
              onClick={() => onEdit(message)}
              className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(message)}
              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MessageGroup({
  messages,
  currentUserId,
  pinnedIds,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onReply,
  onReaction,
  onForward,
}: {
  messages: ChatMessage[];
  currentUserId: string;
  pinnedIds: Set<string>;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onPin: (m: ChatMessage) => void;
  onUnpin: (m: ChatMessage) => void;
  onReply: (m: ChatMessage) => void;
  onReaction: (m: ChatMessage, emoji: string) => void;
  onForward?: (m: ChatMessage) => void;
}) {
  const first = messages[0];
  if (!first) return null;

  return (
    <div className="flex gap-3 px-6 py-2">
      <div className="shrink-0">
        <Avatar name={first.authorName ?? "?"} size="md" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-gray-900">
            {first.authorName ?? "Unknown User"}
          </span>
          <span className="text-xs text-gray-400">
            {formatTimeAgo(first.createdAt)}
          </span>
        </div>
        <div className="mt-0.5 flex flex-col">
          {messages.map((m) => (
            <MessageItem
              key={m.id}
              message={m}
              isOwn={m.authorId === currentUserId}
              isPinned={pinnedIds.has(m.id)}
              onEdit={onEdit}
              onDelete={onDelete}
              onPin={onPin}
              onUnpin={onUnpin}
              onReply={onReply}
              onReaction={onReaction}
              onForward={onForward}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MentionDropdown({
  members,
  query,
  onSelect,
}: {
  members: ChannelMemberLite[];
  query: string;
  onSelect: (m: ChannelMemberLite) => void;
}) {
  const filtered = members.filter((m) =>
    (m.name || "").toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 max-h-48 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
      {filtered.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelect(m)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100"
        >
          <Avatar name={m.name ?? "?"} size="sm" />
          <span className="truncate font-medium text-gray-900">{m.name}</span>
        </button>
      ))}
    </div>
  );
}


function Composer({
  channelId,
  projectId,
  parentMessageId,
  isThread = false,
  placeholder = "Message #general",
}: {
  channelId: string;
  projectId: string;
  parentMessageId?: string;
  isThread?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<{ kind: "user" | "here" | "channel"; userId?: string }[]>([]);
  const [references, setReferences] = useState<{ type: string; id: string; label: string }[]>([]);
  const [attachments, setAttachments] = useState<{ fileId: string; url: string; name: string; mime?: string; size?: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: members = [] } = useChannelMembers(channelId);
  const send = useSendMessage(projectId, channelId);

  useEffect(() => {
    let cancelled = false;
    void readCachedDraft(channelId, parentMessageId).then((draft) => {
      if (!cancelled) setText(draft);
    });
    return () => {
      cancelled = true;
    };
  }, [channelId, parentMessageId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void saveCachedDraft(channelId, parentMessageId, text);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [channelId, parentMessageId, text]);

  const handleFiles = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadFileRequest(file);
        setAttachments((prev) => [
          ...prev,
          { fileId: uploaded.id, url: chatFileUrl(uploaded.id), name: uploaded.fileName, mime: file.type, size: file.size },
        ]);
      }
    } catch {
      toast("Could not upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const atIndex = text.lastIndexOf("@");
  const showMentions = atIndex !== -1 && !text.slice(atIndex).includes(" ");
  const mentionQuery = showMentions ? text.slice(atIndex + 1) : "";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((!text.trim() && references.length === 0 && attachments.length === 0) || send.isPending) return;

      const validMentions = mentions.filter(
        (m) =>
          m.kind === "user" &&
          m.userId &&
          members.find((mb) => mb.id === m.userId)?.name &&
          text.includes(`@${members.find((mb) => mb.id === m.userId)?.name}`)
      );

      send.mutate(
        { body: text.trim(), mentions: validMentions, references, attachments, parentMessageId },
        {
          onSuccess: () => {
            setText("");
            setMentions([]);
            setReferences([]);
            setAttachments([]);
            void clearCachedDraft(channelId, parentMessageId);
          },
        }
      );
    }
  };

  const handleMentionSelect = (m: ChannelMemberLite) => {
    if (!m.name) return;
    const newText = text.slice(0, atIndex) + `@${m.name} `;
    setText(newText);
    setMentions((prev) => [...prev, { kind: "user", userId: m.id }]);
  };

  const submitFromButton = () => {
    handleKeyDown({ key: "Enter", preventDefault: () => {}, shiftKey: false } as unknown as React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>);
  };

  return (
    <div className={cn("relative", isThread ? "" : "px-6 pb-3 pt-1")}>
      {showMentions && (
        <MentionDropdown
          members={members}
          query={mentionQuery}
          onSelect={handleMentionSelect}
        />
      )}
      {pickerOpen && (
        <ReferencePicker
          onSelect={(ref) => {
            if (!references.find(r => r.type === ref.type && r.id === ref.id)) {
              setReferences(prev => [...prev, ref]);
            }
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
      
      {references.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {references.map((r) => (
            <div key={`${r.type}-${r.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
              <span className="text-gray-400">{r.type}</span>
              {r.label}
              <button
                type="button"
                onClick={() => setReferences(prev => prev.filter(x => !(x.type === r.type && x.id === r.id)))}
                className="ml-0.5 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div key={a.fileId} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700">
              <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="max-w-[160px] truncate">{a.name}</span>
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((x) => x.fileId !== a.fileId))}
                className="ml-0.5 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={cn(isThread ? "flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3" : "overflow-hidden rounded-xl border border-gray-200 bg-white")}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        {isThread ? (
          <>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Reply..."
              className="flex-1 bg-transparent text-[15px] text-gray-700 outline-none placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={submitFromButton}
              disabled={(!text.trim() && references.length === 0 && attachments.length === 0) || send.isPending}
              className="text-primary-500 transition-colors hover:text-primary-600 disabled:opacity-50"
              aria-label="Send reply"
            >
              <SendIcon className="size-5" />
            </button>
          </>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-1 border-b border-gray-100 px-3 py-2">
              {[BoldIcon, ItalicIcon, LinkIcon, ListIcon, CodeIcon].map((Icon, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled
                  className="flex size-8 items-center justify-center rounded-md text-gray-400 disabled:opacity-60"
                >
                  <Icon />
                </button>
              ))}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="max-h-56 min-h-[88px] w-full resize-none px-4 py-3 text-[15px] leading-relaxed text-gray-700 outline-none placeholder:text-gray-400"
              rows={3}
            />

            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Attach files"
                  className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                >
                  <PlusCircleIcon />
                </button>
                <button
                  type="button"
                  disabled
                  className="flex size-8 items-center justify-center rounded-md text-gray-400 disabled:opacity-60"
                  title="Emoji picker unavailable"
                >
                  <SmileIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setText((current) => `${current}@`)}
                  className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  title="Mention someone"
                >
                  <AtSignIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setPickerOpen(!pickerOpen)}
                  className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  title="Reference project item"
                >
                  <LinkIcon className="size-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={submitFromButton}
                disabled={(!text.trim() && references.length === 0 && attachments.length === 0) || send.isPending}
                className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
              >
                Send
                <SendIcon />
              </button>
            </div>

          </div>
        )}
      </div>
      {!isThread && (
        <p className="mt-2 text-center text-xs text-gray-500">
          <span className="font-semibold">Return</span> to send, <span className="font-semibold">Shift + Return</span> for new line
        </p>
      )}
    </div>
  );
}



function ThreadPanel({
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
    <div className="relative z-10 flex w-[420px] shrink-0 flex-col border-l border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h3 className="text-lg font-bold text-gray-900">Thread</h3>
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

function NewDmModal({
  members,
  currentUserId,
  onClose,
  onSelect,
}: {
  members: ChannelMemberLite[];
  currentUserId: string;
  onClose: () => void;
  onSelect: (userId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = members.filter(m => 
    m.id !== currentUserId && 
    (m.name || "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="font-semibold text-gray-900">New Direct Message</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-4">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members..."
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 mb-4"
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.map(m => (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-gray-50"
              >
                <Avatar name={m.name ?? "?"} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-gray-900">{m.name}</div>
                  <div className="truncate text-xs text-gray-500">{m.email}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="py-4 text-center text-sm text-gray-500">No members found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageSearch({ onSelect }: { onSelect: (channelId: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isFetching } = useMessageSearch(debouncedQuery);

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)} className="relative flex min-w-[280px] items-center rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-left text-sm text-gray-400 transition-colors hover:border-primary-300">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        Search messages...
      </button>
    );
  }

  return (
    <div className="relative z-10 flex items-center">
      <div className="flex items-center rounded-lg border border-gray-200 bg-white px-2 py-1">
        <SearchIcon className="size-4 text-gray-400" />
        <input
          autoFocus
          className="w-64 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-gray-400"
          placeholder="Search messages..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setQuery("");
            setDebouncedQuery("");
          }}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {debouncedQuery.length >= 2 && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          {isFetching ? (
            <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
          ) : results && results.length > 0 ? (
            <div className="space-y-1">
              {results.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => {
                    onSelect(msg.channelId);
                    setIsOpen(false);
                    setQuery("");
                    setDebouncedQuery("");
                  }}
                  className="flex w-full flex-col items-start gap-1 rounded-md p-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Avatar name={msg.authorName ?? "?"} size="sm" />
                      <span className="text-xs font-medium text-gray-900">{msg.authorName}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{formatTimeAgo(msg.createdAt)}</span>
                  </div>
                  <p className="line-clamp-2 w-full text-xs text-gray-600">{msg.body}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-gray-500">No messages found</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectChat() {
  const { project } = useProjectContext();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? "";

  const { data: projectChannels = [] } = useProjectChannels(project.id);
  const { data: allChannels = [] } = useAllChannels();
  const dmChannels = allChannels.filter((c: Channel) => c.type === "dm");

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [cachedMessages, setCachedMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (projectChannels.length > 0 && !activeChannelId) {
      setActiveChannelId(projectChannels[0]!.id);
    }
  }, [projectChannels, activeChannelId]);

  const { data: messagesData, hasPreviousPage, fetchPreviousPage, isFetchingPreviousPage } = useChannelMessages(activeChannelId);
  const serverMessages = useMemo(
    () => messagesData?.pages.flat() ?? [],
    [messagesData],
  );
  const messages = serverMessages.length > 0 ? serverMessages : cachedMessages;
  useChannelRealtime(activeChannelId ?? undefined);

  useEffect(() => {
    let cancelled = false;
    if (!activeChannelId) {
      setCachedMessages([]);
      return () => {
        cancelled = true;
      };
    }
    void readCachedMessages(activeChannelId).then((rows) => {
      if (!cancelled) setCachedMessages(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [activeChannelId]);

  useEffect(() => {
    if (!activeChannelId || serverMessages.length === 0) return;
    setCachedMessages(serverMessages);
    void cacheMessages(activeChannelId, serverMessages);
  }, [activeChannelId, serverMessages]);
  const markRead = useMarkChannelRead(project.id, activeChannelId!);

  useEffect(() => {
    if (messages.length > 0 && activeChannelId) {
      const lastMsg = messages[messages.length - 1]!;
      markRead.mutate(lastMsg.id);
    }
  }, [messages.length, activeChannelId]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const editMsg = useEditMessage(activeChannelId!);
  const deleteMsg = useDeleteMessage(activeChannelId!);
  const pinMsg = usePinMessage(activeChannelId!);
  const unpinMsg = useUnpinMessage(activeChannelId!);
  const toggleReaction = useToggleReaction(activeChannelId!);
  const updateMembership = useUpdateMembership(activeChannelId!);
  const openDm = useOpenDm();

  const { data: pins = [] } = usePins(activeChannelId);
  const pinnedIds = new Set(pins.map((p: ChatMessage) => p.id));

  
  const defaultProjectChannel = projectChannels[0];
  const { data: channelMembers = [] } = useChannelMembers(
    activeChannelId && projectChannels.find(c => c.id === activeChannelId) 
      ? activeChannelId 
      : defaultProjectChannel?.id
  );

  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [editBody, setEditBody] = useState("");
  const [deletingMsg, setDeletingMsg] = useState<ChatMessage | null>(null);
  
  const [threadRootMsg, setThreadRootMsg] = useState<ChatMessage | null>(null);
  const [showPins, setShowPins] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);

  const handleReaction = (m: ChatMessage, emoji: string) => {
    toggleReaction.mutate({ messageId: m.id, emoji });
  };

  const forwardToTask = useForwardToActionItem();
  const handleForward = (m: ChatMessage) => {
    forwardToTask.mutate(m.id, {
      onSuccess: () => toast("Action item created from message", "success"),
      onError: () => toast("Could not create action item"),
    });
  };

  const activeChannel = projectChannels.find((c) => c.id === activeChannelId) || dmChannels.find((c: Channel) => c.id === activeChannelId);

  const groups: ChatMessage[][] = [];
  let currentGroup: ChatMessage[] = [];
  messages.forEach((m) => {
    if (!currentGroup.length) {
      currentGroup.push(m);
    } else {
      const prev = currentGroup[currentGroup.length - 1]!;
      const sameAuthor = prev.authorId === m.authorId;
      const timeDiff = new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime();
      if (sameAuthor && timeDiff < 5 * 60 * 1000) {
        currentGroup.push(m);
      } else {
        groups.push(currentGroup);
        currentGroup = [m];
      }
    }
  });
  if (currentGroup.length) groups.push(currentGroup);

  if (projectChannels.length === 0 && dmChannels.length === 0) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center p-6">
        <div className="text-center text-gray-500">Start the conversation...</div>
      </div>
    );
  }

  
  return (
    <div className="absolute inset-0 flex min-h-0 w-full overflow-hidden bg-white font-sans text-gray-900">
      <div className="flex w-[300px] shrink-0 flex-col border-r border-gray-200 bg-gray-50">
        <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
          <h2 className="font-semibold text-gray-900">Groups</h2>
          <button className="text-gray-500 transition-colors hover:text-gray-800" aria-label="New message" onClick={() => setShowNewDm(true)}>
            <PlusIcon className="size-5" />
          </button>
        </div>
        <div className="mt-4 flex-1 overflow-y-auto px-3">
          <div>
            <div className="mb-1 flex items-center justify-between px-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Groups</span>
              <PlusIcon className="size-4 text-gray-400" />
            </div>
            <div className="space-y-1">
              {projectChannels.map((c) => (
                <ChannelRow
                  key={c.id}
                  channel={{...c, name: c.name || "general"}}
                  isActive={c.id === activeChannelId}
                  onClick={() => { setActiveChannelId(c.id); setThreadRootMsg(null); }}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 mt-5 flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <span>Direct Messages</span>
              <button onClick={() => setShowNewDm(true)} className="text-gray-400 hover:text-gray-700" aria-label="Add direct message">
                <PlusIcon className="size-4" />
              </button>
            </div>
            <div className="space-y-1">
              {dmChannels.map((c: Channel) => (
                <DmChannelRow
                  key={c.id}
                  channel={c}
                  currentUserId={currentUserId}
                  isActive={c.id === activeChannelId}
                  onClick={() => { setActiveChannelId(c.id); setThreadRootMsg(null); }}
                />
              ))}
            </div>
          </div>
        </div>

      </div>

      {activeChannelId && activeChannel ? (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-start gap-4 border-b border-gray-200 px-6 py-3.5">
            <div className="min-w-0 max-w-[260px]">
              <div className="flex items-center gap-1.5">
                <h3 className="text-lg font-bold text-gray-900">
                  {activeChannel.type === "dm" ? "Direct Message" : <><span className="text-gray-400">#</span> {activeChannel.name || "general"}</>}
                </h3>
                {activeChannel.type !== "dm" && <StarIcon className="text-gray-300" />}
              </div>
              {activeChannel.topic && (
                <p className="mt-0.5 text-xs leading-snug text-gray-500">{activeChannel.topic}</p>
              )}
            </div>
            <div className="flex flex-1 items-center justify-end gap-4">
              <MessageSearch onSelect={(cid) => { setActiveChannelId(cid); setThreadRootMsg(null); }} />
              {pins.length > 0 && (
                <div className="relative">
                  <button onClick={() => setShowPins(!showPins)} className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900">
                    <span className="text-base">📌</span> {pins.length} Pinned
                  </button>
                  {showPins && (
                    <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg z-20">
                      {pins.map((p: ChatMessage) => (
                        <div key={p.id} className="mb-2 p-2 hover:bg-gray-50 rounded group border-b border-gray-100 last:border-0">
                          <div className="text-xs font-medium text-gray-900">{p.authorName}</div>
                          <div className="text-xs text-gray-600 truncate">{p.body}</div>
                          <div className="mt-2 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => unpinMsg.mutate(p.id)} className="text-[10px] font-medium text-gray-400 hover:text-red-500">Unpin</button>
                            <button onClick={() => { setThreadRootMsg(p); setShowPins(false); }} className="text-[10px] font-medium text-gray-400 hover:text-primary-500">Reply</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button 
                onClick={() => updateMembership.mutate({ muted: !activeChannel.muted })}
                className="text-gray-500 hover:text-gray-900 transition-colors"
                title={activeChannel.muted ? "Unmute group" : "Mute group"}
              >
                {activeChannel.muted ? <BellOffIcon className="size-5" /> : <BellIcon className="size-5" />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-4">
            {hasPreviousPage && (
              <div className="flex justify-center py-4">
                <button
                  type="button"
                  disabled={isFetchingPreviousPage}
                  onClick={() => fetchPreviousPage()}
                  className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {isFetchingPreviousPage ? "Loading..." : "Load older messages"}
                </button>
              </div>
            )}
            
            {groups.map((group, i) => (
              <MessageGroup
                key={group[0]!.id + i}
                messages={group}
                currentUserId={currentUserId}
                pinnedIds={pinnedIds}
                onEdit={setEditingMsg}
                onDelete={setDeletingMsg}
                onPin={(m) => pinMsg.mutate(m.id)}
                onUnpin={(m) => unpinMsg.mutate(m.id)}
                onReply={setThreadRootMsg}
                onReaction={handleReaction}
                onForward={handleForward}
              />
            ))}
            <div ref={bottomRef} className="h-4" />
          </div>

          <Composer
            channelId={activeChannelId}
            projectId={project.id}
            placeholder={activeChannel.type === "dm" ? "Message direct message" : `Message #${activeChannel.name || "general"}`}
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-gray-500">
          Select a channel
        </div>
      )}

      {threadRootMsg && (
        <ThreadPanel
          rootMessage={threadRootMsg}
          projectId={project.id}
          currentUserId={currentUserId}
          pinnedIds={pinnedIds}
          onClose={() => setThreadRootMsg(null)}
          onEdit={setEditingMsg}
          onDelete={setDeletingMsg}
          onPin={(m) => pinMsg.mutate(m.id)}
          onUnpin={(m) => unpinMsg.mutate(m.id)}
          onReaction={handleReaction}
        />
      )}

      {showNewDm && (
        <NewDmModal
          members={channelMembers}
          currentUserId={currentUserId}
          onClose={() => setShowNewDm(false)}
          onSelect={(userId) => {
            openDm.mutate({ userId }, {
              onSuccess: (newChannel: Channel) => {
                setActiveChannelId(newChannel.id);
                setShowNewDm(false);
              }
            });
          }}
        />
      )}

      <ConfirmDialog
        open={!!deletingMsg}
        onOpenChange={(open) => { if (!open) setDeletingMsg(null); }}
        title="Delete Message"
        description="Are you sure you want to delete this message? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deletingMsg) deleteMsg.mutate(deletingMsg.id);
        }}
        variant="danger"
      />

      {editingMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Edit message
            </h3>
            <textarea
              autoFocus
              value={editBody || editingMsg.body}
              onChange={(e) => setEditBody(e.target.value)}
              className="h-32 w-full resize-none rounded-md border border-gray-200 p-3 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingMsg(null);
                  setEditBody("");
                }}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  editMsg.mutate({
                    messageId: editingMsg.id,
                    body: editBody || editingMsg.body,
                  });
                  setEditingMsg(null);
                  setEditBody("");
                }}
                className="rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DmChannelRow({
  channel,
  currentUserId,
  isActive,
  onClick,
}: {
  channel: Channel;
  currentUserId: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const { data: members = [] } = useChannelMembers(channel.id);
  const otherMember = members.find(m => m.id !== currentUserId);
  const displayName = otherMember?.name || channel.name || "Unknown User";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
        isActive
          ? "bg-primary-50 text-primary-500"
          : "text-gray-700 hover:bg-gray-100",
        channel.muted && !isActive && "text-gray-400"
      )}
    >
      <div className="shrink-0 relative">
        <Avatar name={displayName} size="sm" />
      </div>
      <span className="flex-1 truncate">{displayName}</span>
      {channel.unreadCount > 0 && (
        <span className="flex h-5 items-center justify-center rounded-full bg-primary-500 px-2 text-[10px] font-bold text-white">
          {channel.unreadCount}
        </span>
      )}
    </button>
  );
}

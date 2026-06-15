import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
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
} from "@/hooks/use-chat";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { formatTimeAgo } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useChannelRealtime } from "@/lib/realtime";
import type { Channel, ChatMessage, ChannelMemberLite } from "@/lib/project-types";


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
          ? "bg-primary-50 text-primary-700"
          : "text-gray-700 hover:bg-gray-100",
        channel.muted && !isActive && "text-gray-400"
      )}
    >
      <span className="text-gray-400">#</span>
      <span className="flex-1 truncate">{channel.name || "general"}</span>
      {channel.unreadCount > 0 && (
        <span className="flex h-5 items-center justify-center rounded-full bg-primary-600 px-2 text-[10px] font-bold text-white">
          {channel.unreadCount}
        </span>
      )}
    </button>
  );
}

function ReferenceChip({ refItem }: { refItem: NonNullable<ChatMessage["resolvedReferences"]>[0] }) {
  if (refItem.restricted) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-[#F6F6F6] px-2 py-1 text-xs text-gray-400">
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
    <Link to={refItem.url!} className="inline-flex items-center gap-2 rounded border border-[#EDEDED] bg-white px-2.5 py-1.5 text-xs transition-shadow hover:shadow-sm">
      <span className="font-medium text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900">{refItem.title}</span>
      {refItem.status && (
        <Badge variant="outline" className="text-[10px] leading-none py-0.5 px-1.5">{refItem.status}</Badge>
      )}
    </Link>
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
          className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
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
  onEdit,
  onDelete,
}: {
  message: ChatMessage;
  isOwn: boolean;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
}) {
  if (message.deletedAt) {
    return (
      <div className="py-1 pl-12 text-sm italic text-gray-400">
        This message was deleted
      </div>
    );
  }

  return (
    <div className="group relative py-1 pl-12 hover:bg-gray-50/50">
      <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">
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

      {isOwn && (
        <div className="absolute right-4 -top-2 hidden items-center gap-1 rounded-md border border-gray-200 bg-white p-1 shadow-sm group-hover:flex">
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
        </div>
      )}
    </div>
  );
}

function MessageGroup({
  messages,
  currentUserId,
  onEdit,
  onDelete,
}: {
  messages: ChatMessage[];
  currentUserId: string;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
}) {
  const first = messages[0];
  if (!first) return null;

  const isOwn = first.authorId === currentUserId;

  return (
    <div className="mt-4 flex gap-3 px-4">
      <div className="mt-1 shrink-0">
        <Avatar name={first.authorName ?? "?"} size="md" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-gray-900">
            {first.authorName ?? "Unknown User"}
          </span>
          <span className="text-xs text-gray-500">
            {formatTimeAgo(first.createdAt)}
          </span>
        </div>
        <div className="mt-1 flex flex-col">
          {messages.map((m) => (
            <MessageItem
              key={m.id}
              message={m}
              isOwn={isOwn}
              onEdit={onEdit}
              onDelete={onDelete}
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
}: {
  channelId: string;
  projectId: string;
}) {
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<{ kind: "user" | "here" | "channel"; userId?: string }[]>([]);
  const [references, setReferences] = useState<{ type: string; id: string; label: string }[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: members = [] } = useChannelMembers(channelId);
  const send = useSendMessage(projectId, channelId);

  const atIndex = text.lastIndexOf("@");
  const showMentions = atIndex !== -1 && !text.slice(atIndex).includes(" ");
  const mentionQuery = showMentions ? text.slice(atIndex + 1) : "";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((!text.trim() && references.length === 0) || send.isPending) return;

      const validMentions = mentions.filter(
        (m) =>
          m.kind === "user" &&
          m.userId &&
          members.find((mb) => mb.id === m.userId)?.name &&
          text.includes(`@${members.find((mb) => mb.id === m.userId)?.name}`)
      );

      send.mutate(
        { body: text.trim(), mentions: validMentions, references },
        {
          onSuccess: () => {
            setText("");
            setMentions([]);
            setReferences([]);
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

  return (
    <div className="relative border-t border-gray-200 bg-white p-4">
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

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(!pickerOpen)}
          className="mb-1 flex shrink-0 items-center justify-center rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </button>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message... (Enter to send, Shift+Enter for newline)"
          className="min-h-[44px] max-h-48 flex-1 resize-none rounded-xl border border-gray-300 bg-[#F6F6F6] px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          rows={1}
        />
        <button
          type="button"
          onClick={() => handleKeyDown({ key: "Enter", preventDefault: () => {}, shiftKey: false } as unknown as React.KeyboardEvent<HTMLTextAreaElement>)}
          disabled={(!text.trim() && references.length === 0) || send.isPending}
          className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}


export default function ProjectChat() {
  const { project } = useProjectContext();
  const { data: session } = authClient.useSession();
  const { data: channels = [] } = useProjectChannels(project.id);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      setActiveChannelId(channels[0]!.id);
    }
  }, [channels, activeChannelId]);

  const { data: messagesData, hasPreviousPage, fetchPreviousPage, isFetchingPreviousPage } = useChannelMessages(activeChannelId);
  const messages = messagesData?.pages.flat() || [];
  useChannelRealtime(activeChannelId ?? undefined);
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
  
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [editBody, setEditBody] = useState("");
  
  const [deletingMsg, setDeletingMsg] = useState<ChatMessage | null>(null);

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

  if (channels.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-4rem)] w-full items-center justify-center p-6">
        <div className="text-center text-gray-500">Start the conversation...</div>
      </div>
    );
  }

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  return (
    <div className="flex h-[calc(100dvh-4rem)] w-full overflow-hidden bg-white">
      <div className="flex w-64 flex-col border-r border-gray-200 bg-gray-50/50">
        <div className="flex h-14 items-center border-b border-gray-200 px-4">
          <h2 className="font-semibold text-gray-900">Channels</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {channels.map((c) => (
            <ChannelRow
              key={c.id}
              channel={c}
              isActive={c.id === activeChannelId}
              onClick={() => setActiveChannelId(c.id)}
            />
          ))}
        </div>
      </div>

      {activeChannelId ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex h-14 items-center border-b border-gray-200 px-6">
            <h3 className="font-semibold text-gray-900">
              # {activeChannel?.name || "general"}
            </h3>
            {activeChannel?.topic && (
              <span className="ml-3 border-l border-gray-300 pl-3 text-sm text-gray-500">
                {activeChannel.topic}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pb-4">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                No messages yet.
              </div>
            ) : (
              <div className="flex flex-col pt-4">
                {hasPreviousPage && (
                  <button
                    type="button"
                    disabled={isFetchingPreviousPage}
                    className="mx-auto mb-4 rounded-full bg-gray-100 px-4 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                    onClick={() => fetchPreviousPage()}
                  >
                    {isFetchingPreviousPage ? "Loading..." : "Load older messages"}
                  </button>
                )}
                {groups.map((group, i) => (
                  <MessageGroup
                    key={i}
                    messages={group}
                    currentUserId={session?.user?.id || ""}
                    onEdit={(m) => {
                      setEditingMsg(m);
                      setEditBody(m.body);
                    }}
                    onDelete={setDeletingMsg}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {editingMsg ? (
            <div className="border-t border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Edit Message</span>
                <button
                  type="button"
                  onClick={() => setEditingMsg(null)}
                  className="text-xs text-gray-500 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                rows={2}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (editBody.trim() && editBody !== editingMsg.body) {
                      editMsg.mutate({ messageId: editingMsg.id, body: editBody.trim() });
                    }
                    setEditingMsg(null);
                  }}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <Composer channelId={activeChannelId} projectId={project.id} />
          )}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-gray-50">
          <span className="text-sm text-gray-500">Select a channel to start chatting</span>
        </div>
      )}

      <ConfirmDialog
        open={!!deletingMsg}
        onOpenChange={(o) => !o && setDeletingMsg(null)}
        title="Delete message"
        description="Are you sure you want to delete this message? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deletingMsg) deleteMsg.mutate(deletingMsg.id);
        }}
      />
    </div>
  );
}

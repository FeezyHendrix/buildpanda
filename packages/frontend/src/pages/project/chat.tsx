import { useState, useRef, useEffect, useMemo } from "react";
import { useProjectContext } from "@/layouts/project-layout";
import { toast } from "@/lib/toast";
import {
  useProjectChannels,
  useChannelMessages,
  useEditMessage,
  useDeleteMessage,
  useMarkChannelRead,
  useToggleReaction,
  usePins,
  usePinMessage,
  useUnpinMessage,
  useOpenDm,
  useAllChannels,
  useUpdateMembership,
  useForwardToActionItem,
  useChannelMembers,
  useCreateChannel,
} from "@/hooks/use-chat";
import { authClient } from "@/lib/auth-client";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { useChannelRealtime } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { cacheMessages, readCachedMessages } from "@/lib/chat-cache";
import type { Channel, ChatMessage } from "@/lib/project-types";
import { BellIcon, BellOffIcon, PlusIcon, StarIcon } from "@/components/atoms/chat-icons";

import { ChannelRow } from "./chat/channel-row";
import { MessageGroup } from "./chat/message-group";
import { Composer } from "./chat/composer";
import { ThreadPanel } from "./chat/thread-panel";
import { NewDmModal } from "./chat/new-dm-modal";
import { NewGroupDialog } from "./chat/new-group-dialog";
import { MessageSearch } from "./chat/message-search";
import { DmChannelRow } from "./chat/dm-channel-row";
import { DmHeaderTitle } from "./chat/dm-header-title";

export default function ProjectChat() {
  const { project } = useProjectContext();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? "";

  const { data: projectChannels = [] } = useProjectChannels(project.id);
  const { data: allChannels = [] } = useAllChannels();
  const dmChannels = allChannels.filter((c: Channel) => c.type === "dm");

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
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
  const [quotedMsg, setQuotedMsg] = useState<ChatMessage | null>(null);
  const [showPins, setShowPins] = useState(false);

  useEffect(() => {
    setQuotedMsg(null);
  }, [activeChannelId]);

  const handleJumpToMessage = (messageId: string) => {
    const el = document.getElementById(`message-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-primary-50");
      setTimeout(() => el.classList.remove("bg-primary-50"), 1500);
    }
  };
  const [showNewDm, setShowNewDm] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const createChannel = useCreateChannel();

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
    <div className="absolute inset-0 flex min-h-0 w-full overflow-hidden bg-white">
      <div className={cn(
        "flex flex-col border-r border-gray-200 bg-gray-50/50",
        "w-full lg:w-64",
        mobileShowChat ? "hidden lg:flex" : "flex",
      )}>
        <div className="flex h-14 items-center border-b border-gray-200 px-4">
          <h2 className="font-semibold text-gray-900">Channels</h2>
        </div>
        <div className="mt-4 flex-1 overflow-y-auto px-3">
          <div>
            <div className="mb-1 flex items-center justify-between px-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-black-300">Groups</span>
              <button onClick={() => setShowNewGroup(true)} className="text-gray-400 hover:text-gray-700" aria-label="New group">
                <PlusIcon className="size-4" />
              </button>
            </div>
            <div className="space-y-1">
              {projectChannels.map((c) => (
                <ChannelRow
                  key={c.id}
                  channel={{...c, name: c.name || "general"}}
                  isActive={c.id === activeChannelId}
                  onClick={() => { setActiveChannelId(c.id); setThreadRootMsg(null); setMobileShowChat(true); }}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 mt-5 flex items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wider text-black-300">
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
                  onClick={() => { setActiveChannelId(c.id); setThreadRootMsg(null); setMobileShowChat(true); }}
                />
              ))}
            </div>
          </div>
        </div>

      </div>

      {activeChannelId && activeChannel ? (
        <div className={cn("flex min-w-0 flex-1 flex-col overflow-hidden", !mobileShowChat && "hidden lg:flex")}>
          <div className="relative overflow-visible flex items-start gap-4 border-b border-gray-200 px-4 lg:px-6 py-3.5">
            <div className="min-w-0 max-w-[260px]">
              <div className="flex items-center gap-2 lg:gap-1.5">
              <button
                type="button"
                onClick={() => setMobileShowChat(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden"
                aria-label="Back to channels"
              >
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
                <h3 className="text-[15px] font-semibold text-black-900">
                  {activeChannel.type === "dm" ? (
                    <DmHeaderTitle channel={activeChannel} currentUserId={currentUserId} />
                  ) : (
                    <><span className="text-gray-400">#</span> {activeChannel.name || "general"}</>
                  )}
                </h3>
                {activeChannel.type !== "dm" && <StarIcon className="size-4 text-gray-300" />}
              </div>
              {activeChannel.topic && (
                <p className="hidden mt-0.5 text-[11px] leading-snug text-black-300 sm:inline">{activeChannel.topic}</p>
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
                onQuote={setQuotedMsg}
                onJumpToMessage={handleJumpToMessage}
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
            quotedMessage={quotedMsg}
            onClearQuote={() => setQuotedMsg(null)}
          />
        </div>
      ) : (
        <div className={cn("flex flex-1 items-center justify-center text-gray-500", !mobileShowChat && "hidden lg:flex")}>
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

      <NewGroupDialog
        open={showNewGroup}
        onClose={() => setShowNewGroup(false)}
        loading={createChannel.isPending}
        onSubmit={(name, isPrivate) => {
          createChannel.mutate(
            { type: "project", name, projectId: project.id, isPrivate },
            {
              onSuccess: (newChannel) => {
                setActiveChannelId(newChannel.id);
                setShowNewGroup(false);
                toast("Group created", "success");
              },
              onError: (err) => {
                const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
                setShowNewGroup(false);
                toast(message ?? "Could not create group");
              },
            },
          );
        }}
      />

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
            <h3 className="mb-4 text-[15px] font-semibold text-black-900">
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

import { useUrlState } from "@/hooks/use-url-state";
import { useCachedMessages } from "./chat/use-cached-messages";
import { useMessageDestination } from "./chat/use-message-destination";
import { MessageEditDialog } from "./chat/message-edit-dialog";
import { groupMessages } from "./chat/group-messages";
import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/atoms/button";
import { useProjectContext } from "@/layouts/project-layout";
import { toast } from "@/lib/toast";
import {
  useProjectChannels,
  useChannelMessages,
  useDeleteMessage,
  useMarkChannelRead,
  useToggleReaction,
  usePins,
  usePinMessage,
  useUnpinMessage,
  useOpenDm,
  useAllChannels,
  useUpdateMembership,
  useForwardToTask,
  useChannelMembers,
  useCreateChannel,
} from "@/hooks/use-chat";
import { authClient } from "@/lib/auth-client";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { useChannelRealtime } from "@/lib/realtime";
import { cn } from "@/lib/utils";
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
  return <ChatWorkspace projectId={project.id} />;
}

export function ChatWorkspace({ projectId = "" }: { projectId?: string }) {
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? "";

  const { data: scopedChannels = [] } = useProjectChannels(projectId);
  const { data: allChannels = [] } = useAllChannels();
  const projectChannels = projectId ? scopedChannels : allChannels.filter(c => c.type === "project" || c.type === "org");
  const dmChannels = allChannels.filter(c => c.type === "dm" || c.type === "group_dm");

  const [activeChannelId, setActiveChannelId] = useUrlState<string | null>("channel", null);
  const [targetMessageId] = useUrlState<string | null>("message", null);
  const [mobileShowChat, setMobileShowChat] = useState(Boolean(activeChannelId));
  const firstChannelId = projectChannels[0]?.id ?? dmChannels[0]?.id;

  useEffect(() => {
    if (firstChannelId && !activeChannelId) {
      setActiveChannelId(firstChannelId);
    }
  }, [firstChannelId, activeChannelId, setActiveChannelId]);

  const { data: messagesData, hasPreviousPage, fetchPreviousPage, isFetchingPreviousPage, isPending: messagesPending } = useChannelMessages(activeChannelId);
  const serverMessages = useMemo(
    () => messagesData?.pages.flat() ?? [],
    [messagesData],
  );
  const messages = useCachedMessages(activeChannelId, serverMessages, messagesData !== undefined);
  const destinationError = useMessageDestination(messages, hasPreviousPage, isFetchingPreviousPage || messagesPending, fetchPreviousPage);
  useChannelRealtime(activeChannelId ?? undefined);

  const markRead = useMarkChannelRead(projectId, activeChannelId!);
  const markChannelRead = markRead.mutate;
  const lastMessageId = serverMessages[serverMessages.length - 1]?.id;

  useEffect(() => {
    if (lastMessageId && activeChannelId) {
      markChannelRead(lastMessageId);
    }
  }, [lastMessageId, activeChannelId, markChannelRead]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!targetMessageId) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessageId, targetMessageId]);

  const deleteMsg = useDeleteMessage(activeChannelId!);
  const pinMsg = usePinMessage(activeChannelId!);
  const unpinMsg = useUnpinMessage(activeChannelId!);
  const toggleReaction = useToggleReaction(activeChannelId!);
  const updateMembership = useUpdateMembership(activeChannelId!);
  const openDm = useOpenDm();

  const { data: pins = [] } = usePins(activeChannelId);
  const pinnedIds = new Set(pins.map((p: ChatMessage) => p.id));

  const { data: channelMembers = [] } = useChannelMembers(activeChannelId ?? undefined);

  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
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

  const forwardToTask = useForwardToTask();
  const handleForward = (m: ChatMessage) => {
    forwardToTask.mutate(m.id, {
      onSuccess: () => toast("Task created from message", "success"),
      onError: () => toast("Could not create task"),
    });
  };

  const activeChannel = projectChannels.find((c) => c.id === activeChannelId) || dmChannels.find((c: Channel) => c.id === activeChannelId);

  const groups = groupMessages(messages);

  if (projectChannels.length === 0 && dmChannels.length === 0) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center p-6">
        <div className="text-center text-ink-muted">Start the conversation...</div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex min-h-0 w-full overflow-hidden bg-white">
      <div className={cn(
        "flex flex-col border-r border-line-hair bg-surface-alt",
        "w-full lg:w-64",
        mobileShowChat ? "hidden lg:flex" : "flex",
      )}>
        <div className="flex h-14 items-center border-b border-line-hair px-4">
          <h2 className="font-semibold text-ink">Channels</h2>
        </div>
        <div className="mt-4 flex-1 overflow-y-auto px-3">
          <div>
            <div className="mb-1 flex items-center justify-between px-3">
              <span className="text-xs font-medium uppercase text-ink-muted">Groups</span>
              <button hidden={!projectId} type="button" onClick={() => setShowNewGroup(true)} className="rounded-md p-1.5 text-ink-muted hover:bg-black/5 hover:text-ink" aria-label="New group">
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
            <div className="mb-1 mt-5 flex items-center justify-between px-3 text-xs font-medium uppercase text-ink-muted">
              <span>Direct Messages</span>
              <button type="button" onClick={() => setShowNewDm(true)} className="rounded-md p-1.5 text-ink-muted hover:bg-black/5 hover:text-ink" aria-label="Add direct message">
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
          <div className="relative overflow-visible flex items-start gap-4 border-b border-line-hair px-4 lg:px-6 py-3.5">
            <div className="min-w-0 max-w-[260px]">
              <div className="flex items-center gap-2 lg:gap-1.5">
              <button
                type="button"
                onClick={() => setMobileShowChat(false)}
                className="rounded-md p-1.5 text-ink-muted hover:bg-black/5 hover:text-ink lg:hidden"
                aria-label="Back to channels"
              >
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
                <h3 className="text-base font-semibold text-ink">
                  {activeChannel.type === "dm" ? (
                    <DmHeaderTitle channel={activeChannel} currentUserId={currentUserId} />
                  ) : (
                    <><span className="text-ink-muted">#</span> {activeChannel.name || "general"}</>
                  )}
                </h3>
                {activeChannel.type !== "dm" && <StarIcon className="size-4 text-ink-disabled" />}
              </div>
              {activeChannel.topic && (
                <p className="hidden mt-0.5 text-xs leading-snug text-ink-muted sm:inline">{activeChannel.topic}</p>
              )}
            </div>
            <div className="flex flex-1 items-center justify-end gap-4">
              <MessageSearch onSelect={(cid) => { setActiveChannelId(cid); setThreadRootMsg(null); }} />
              {pins.length > 0 && (
                <div className="relative">
                  <button type="button" onClick={() => setShowPins(!showPins)} className="flex items-center gap-1 text-sm font-medium text-ink hover:text-primary-500">
                    <span className="text-base">📌</span> {pins.length} Pinned
                  </button>
                  {showPins && (
                    <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto rounded-lg border border-line bg-white p-2 shadow-card z-20">
                      {pins.map((p: ChatMessage) => (
                        <div key={p.id} className="mb-2 p-2 hover:bg-surface-alt rounded group border-b border-line-hair last:border-0">
                          <div className="text-xs font-medium text-ink">{p.authorName}</div>
                          <div className="text-xs text-ink truncate">{p.body}</div>
                          <div className="mt-2 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => unpinMsg.mutate(p.id)} className="text-[10px] font-medium text-ink-muted hover:text-negative-500">Unpin</button>
                            <button onClick={() => { setThreadRootMsg(p); setShowPins(false); }} className="text-[10px] font-medium text-ink-muted hover:text-primary-500">Reply</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => updateMembership.mutate({ muted: !activeChannel.muted })}
                className="rounded-md p-1.5 text-ink-muted hover:bg-black/5 hover:text-ink"
                title={activeChannel.muted ? "Unmute group" : "Mute group"}
              >
                {activeChannel.muted ? <BellOffIcon className="size-5" /> : <BellIcon className="size-5" />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-4">
            {destinationError ? <p role="status" className="p-4 text-sm text-ink-muted">{destinationError}</p> : null}
            {hasPreviousPage && (
              <div className="flex justify-center py-4">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={isFetchingPreviousPage}
                  onClick={() => fetchPreviousPage()}
                  className="rounded-full"
                >
                  Load older messages
                </Button>
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
            projectId={projectId}
            placeholder={activeChannel.type === "dm" ? "Message direct message" : `Message #${activeChannel.name || "general"}`}
            quotedMessage={quotedMsg}
            onClearQuote={() => setQuotedMsg(null)}
          />
        </div>
      ) : (
        <div className={cn("flex flex-1 items-center justify-center text-ink-muted", !mobileShowChat && "hidden lg:flex")}>
          Select a channel
        </div>
      )}

      {threadRootMsg && (
        <ThreadPanel
          rootMessage={threadRootMsg}
          projectId={projectId}
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
            { type: "project", name, projectId: projectId, isPrivate },
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

      {editingMsg ? <MessageEditDialog key={editingMsg.id} message={editingMsg} onClose={() => setEditingMsg(null)} /> : null}
    </div>
  );
}

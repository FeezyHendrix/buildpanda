import { Fragment } from "react";
import { useUrlState } from "@/hooks/use-url-state";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { useCachedMessages } from "./chat/use-cached-messages";
import { useMessageDestination } from "./chat/use-message-destination";
import { MessageEditDialog } from "./chat/message-edit-dialog";
import { dayKey, groupMessages } from "./chat/group-messages";
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

import { ChannelList } from "./chat/channel-list";
import { ChannelHeader } from "./chat/channel-header";
import { DayDivider } from "./chat/day-divider";
import { MessageGroup } from "./chat/message-group";
import { Composer } from "./chat/composer";
import { ThreadPanel } from "./chat/thread-panel";
import { NewDmModal } from "./chat/new-dm-modal";
import { NewGroupDialog } from "./chat/new-group-dialog";

export default function ProjectChat() {
  useSetPageTitle("Messages", "Talk with your project team in groups and direct messages.");
  const { project } = useProjectContext();
  return <ChatWorkspace projectId={project.id} framed />;
}

/** `framed` sits the chat in a bordered card inside the page, as the project's Messages page does. */
export function ChatWorkspace({ projectId = "", framed = false }: { projectId?: string; framed?: boolean }) {
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

  function selectChannel(channelId: string): void {
    setActiveChannelId(channelId);
    setThreadRootMsg(null);
    setMobileShowChat(true);
  }

  return (
    <div className={cn("absolute inset-0 flex min-h-0 w-full overflow-hidden bg-white", framed && "px-4 pt-6 lg:pl-8 lg:pr-[42px]")}>
      <div className={cn("relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-white", framed && "border border-b-0 border-[#EEEEEE]")}>
      <ChannelList
        groups={projectChannels}
        directMessages={dmChannels}
        currentUserId={currentUserId}
        activeChannelId={activeChannelId}
        canCreateGroup={Boolean(projectId)}
        onSelect={selectChannel}
        onNewGroup={() => setShowNewGroup(true)}
        onNewDm={() => setShowNewDm(true)}
        className={cn("w-full", mobileShowChat ? "hidden lg:flex" : "flex")}
      />

      {activeChannelId && activeChannel ? (
        <div className={cn("flex min-w-0 flex-1 flex-col overflow-hidden", !mobileShowChat && "hidden lg:flex")}>
          <ChannelHeader
            channel={activeChannel}
            currentUserId={currentUserId}
            pins={pins}
            onBack={() => setMobileShowChat(false)}
            onSearchSelect={(cid) => {
              setActiveChannelId(cid);
              setThreadRootMsg(null);
            }}
            onToggleMute={() => updateMembership.mutate({ muted: !activeChannel.muted })}
            onUnpin={(m) => unpinMsg.mutate(m.id)}
            onReplyToPin={setThreadRootMsg}
          />

          <div className="flex-1 overflow-y-auto py-[10px]">
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
            {groups.map((group, i) => {
              const first = group[0]!;
              const previousFirst = groups[i - 1]?.[0];
              return (
                <Fragment key={first.id + i}>
                  {!previousFirst || dayKey(previousFirst.createdAt) !== dayKey(first.createdAt) ? (
                    <DayDivider iso={first.createdAt} />
                  ) : null}
                  <MessageGroup
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
                </Fragment>
              );
            })}
            <div ref={bottomRef} className="h-4" />
          </div>

          <Composer
            channelId={activeChannelId}
            projectId={projectId}
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

      </div>

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

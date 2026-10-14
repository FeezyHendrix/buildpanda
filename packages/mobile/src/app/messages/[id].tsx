import { withProjectPermission } from "@/components/molecules/permission-gate";
import { Redirect, useLocalSearchParams } from "expo-router";
import { Conversation } from "@/components/messaging/conversation";
import { useFieldSession } from "@/lib/field-session";

function ConversationScreen() {
  const params = useLocalSearchParams<{ id: string; thread?: string }>();
  const { storageOwnerId, organizationId, isReady } = useFieldSession();
  if (!isReady) return null;
  if (!storageOwnerId || typeof params.id !== "string") return <Redirect href="/" />;
  const threadId = typeof params.thread === "string" ? params.thread : undefined;
  return <Conversation key={JSON.stringify([storageOwnerId, organizationId, params.id, threadId])} channelId={params.id} threadId={threadId} />;
}

export default withProjectPermission(ConversationScreen, "/messages/[id]");

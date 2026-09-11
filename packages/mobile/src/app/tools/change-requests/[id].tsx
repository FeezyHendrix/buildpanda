import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { CHANGE_STATUS_LABELS, type ChangeStatus } from "@/api/change-requests";
import { Card, PendingBadge, Spinner, Text } from "@/components/atoms";
import { ICON_INVERSE, ICON_SUBTLE } from "@/constants/colors";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useAddChangeRequestComment, useChangeRequestComments } from "@/hooks/use-change-request-comments";
import { useDeleteChangeRequest, useLocalChangeRequest } from "@/hooks/use-local-change-requests";
import { formatDateTime } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<ChangeStatus, { bg: string; text: string }> = {
  Draft: { bg: "bg-grey-50", text: "text-grey-500" },
  Submitted: { bg: "bg-primary-50", text: "text-primary-700" },
  Approved: { bg: "bg-success-50", text: "text-success-700" },
  Rejected: { bg: "bg-error-50", text: "text-error-600" },
};

function CommentThread({ db, projectId, changeId }: { db: Db; projectId: string; changeId: string }) {
  const { data, isPending } = useChangeRequestComments(db, projectId, changeId);

  if (isPending) {
    return (
      <View className="items-center py-6">
        <Spinner size="md" />
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <Text tone="secondary" className="px-6 py-4 text-center text-[13px]">
        No comments yet. Add one below — it is saved on your device and uploads when you have signal.
      </Text>
    );
  }

  return (
    <Card>
      {data.map((c) => (
        <View key={c.id} className="border-b border-hairline px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Text weight="semibold" className="flex-1 text-[13px]" numberOfLines={1}>
              {c.authorName || "You"}
            </Text>
            {c.isPendingSync ? (
              <PendingBadge />
            ) : (
              <Text tone="muted" className="text-[11px]">
                {formatDateTime(c.createdAt)}
              </Text>
            )}
          </View>
          <Text className="pt-1 text-[15px]">{c.body}</Text>
        </View>
      ))}
    </Card>
  );
}

function CRDetailContent({ db, projectId, changeId }: { db: Db; projectId: string; changeId: string }) {
  const { data: cr } = useLocalChangeRequest(db, changeId);

  if (!cr) {
    return (
      <View className="items-center py-12">
        <Text tone="secondary" className="text-[13px]">This change request may not have synced yet.</Text>
      </View>
    );
  }

  const tone = STATUS_TONE[cr.status] ?? STATUS_TONE.Draft;

  return (
    <View className="gap-5">
      <View className="flex-row flex-wrap items-center gap-2">
        <View className={cn("rounded-full px-2.5 py-1", tone.bg)}>
          <Text weight="semibold" className={cn("text-[11px] uppercase", tone.text)}>
            {CHANGE_STATUS_LABELS[cr.status]}
          </Text>
        </View>
        {cr.isPendingSync ? <PendingBadge /> : null}
      </View>

      <Text weight="bold" className="text-lg">{cr.title}</Text>
      {cr.description ? <Text tone="secondary" className="text-[15px]">{cr.description}</Text> : null}

      <View className="flex-row gap-4">
        {cr.costImpact ? (
          <View>
            <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Cost impact</Text>
            <Text weight="bold" className="text-base">{cr.currency} {cr.costImpact.toLocaleString()}</Text>
          </View>
        ) : null}
        {cr.timeImpactDays ? (
          <View>
            <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Time impact</Text>
            <Text weight="bold" className="text-base">{cr.timeImpactDays} days</Text>
          </View>
        ) : null}
      </View>

      <View>
        <Text weight="bold" className="pb-2 text-base">Comments</Text>
        <CommentThread db={db} projectId={projectId} changeId={changeId} />
      </View>
    </View>
  );
}

export default function ChangeRequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const removeRecord = useDeleteChangeRequest(db, projectId);
  const addComment = useAddChangeRequestComment(db, projectId);
  const { data: session } = useSession();

  // Native confirm: deleting a site record is destructive and the app has no
  // undo, so it must not happen on a single stray tap.
  function confirmDelete() {
    if (!id) return;
    Alert.alert("Delete this change request?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void removeRecord(id).then(() => router.back()).catch(() => undefined);
        },
      },
    ]);
  }

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const canSend = body.trim().length > 0 && !sending;

  // The comment is written to SQLite and queued; no signal needed. A failure
  // here is a local write failing, so what was typed stays in the box.
  async function handleSend() {
    if (!canSend || !id) return;
    setSending(true);
    setSendError(null);
    try {
      await addComment(id, body.trim(), session?.user.name ?? "You");
      setBody("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not save that comment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Page
      title="Change request"
      onBack={() => router.back()}
      rightButtons={
        id ? (
          <>
            <HeaderIconButton icon="create-outline" label="Edit change request" onPress={() => router.push(`/tools/change-requests/edit/${id}` as never)} />
            <HeaderIconButton icon="trash-outline" label="Delete change request" onPress={confirmDelete} />
          </>
        ) : null
      }
      scroll
      footer={
        id ? (
          <View className="gap-2">
            {sendError ? (
              <Text tone="danger" className="px-1 text-xs">
                {sendError}
              </Text>
            ) : null}
            <View className="flex-row items-end gap-2">
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Add a comment"
                placeholderTextColor={ICON_SUBTLE}
                multiline
                className="max-h-28 min-h-14 flex-1 rounded-xl bg-surface-alt px-4 py-3 font-jakarta text-base text-black-500"
              />
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Send comment"
                accessibilityState={{ disabled: !canSend, busy: sending }}
                className={cn("h-14 w-14 items-center justify-center rounded-xl bg-primary-500", !canSend && "opacity-50")}
              >
                {sending ? <Spinner size="xs" tone="current" /> : <Ionicons name="arrow-up" size={20} color={ICON_INVERSE} />}
              </Pressable>
            </View>
          </View>
        ) : undefined
      }
    >
      {ready && db && projectId && id ? (
        <CRDetailContent db={db} projectId={projectId} changeId={id} />
      ) : (
        <View className="items-center py-12"><Spinner size="md" /></View>
      )}
    </Page>
  );
}

import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { changeRequestsApi, type ChangeRequestComment, type ChangeStatus } from "@/api/change-requests";
import { Card, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { changeRequestsRepository, toChangeRequest } from "@/db/change-requests-repository";
import { useLocalDb } from "@/db/provider";
import { useFieldSession } from "@/lib/field-session";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<ChangeStatus, { bg: string; text: string }> = {
  Draft: { bg: "bg-grey-50", text: "text-grey-500" },
  Submitted: { bg: "bg-primary-50", text: "text-primary-700" },
  Approved: { bg: "bg-success-50", text: "text-success-700" },
  Rejected: { bg: "bg-error-50", text: "text-error-600" },
};

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function CRDetailContent({ db, projectId, changeId }: { db: Db; projectId: string; changeId: string }) {
  const query = useMemo(() => changeRequestsRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query);
  const cr = useMemo(() => (live.data ?? []).map(toChangeRequest).find((r) => r.id === changeId), [live.data, changeId]);

  const [comments, setComments] = useState<ChangeRequestComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);

  useEffect(() => {
    if (changeId.startsWith("local_")) { setLoadingComments(false); return; }
    let cancelled = false;
    changeRequestsApi.detail(projectId, changeId).then((detail) => {
      if (!cancelled) setComments(detail.comments ?? []);
    }).catch(() => undefined).finally(() => { if (!cancelled) setLoadingComments(false); });
    return () => { cancelled = true; };
  }, [projectId, changeId]);

  if (!cr) {
    return (
      <View className="items-center py-12">
        <Text tone="secondary" className="text-[13px]">This change request may not have synced yet.</Text>
      </View>
    );
  }

  const tone = STATUS_TONE[cr.status as ChangeStatus] ?? STATUS_TONE.Draft;

  return (
    <View className="gap-5">
      <View className="flex-row flex-wrap items-center gap-2">
        <View className={cn("rounded-full px-2.5 py-1", tone.bg)}>
          <Text weight="semibold" className={cn("text-[11px] uppercase", tone.text)}>{cr.status}</Text>
        </View>
        {cr.isPendingSync ? (
          <View className="flex-row items-center gap-1 rounded-full bg-surface-alt px-2 py-1">
            <Ionicons name="cloud-upload-outline" size={12} color="#717171" />
            <Text weight="semibold" tone="secondary" className="text-[10px] uppercase">Pending</Text>
          </View>
        ) : null}
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
        {loadingComments ? (
          <View className="items-center py-6"><Spinner size="md" /></View>
        ) : comments.length === 0 ? (
          <Text tone="secondary" className="py-4 text-center text-[13px]">No comments yet.</Text>
        ) : (
          <Card>
            {comments.map((c) => (
              <View key={c.id} className="border-b border-hairline px-4 py-3">
                <View className="flex-row items-center gap-2">
                  <Text weight="semibold" className="flex-1 text-[13px]" numberOfLines={1}>{c.authorName}</Text>
                  <Text tone="muted" className="text-[11px]">{timeLabel(c.createdAt)}</Text>
                </View>
                <Text className="pt-1 text-[15px]">{c.body}</Text>
              </View>
            ))}
          </Card>
        )}
      </View>
    </View>
  );
}

export default function ChangeRequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const { data: session } = useSession();

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!body.trim() || !id || !projectId || sending) return;
    setSending(true);
    try {
      await changeRequestsApi.addComment(projectId, id, body.trim());
      setBody("");
    } catch { /* offline: will fail silently */ }
    finally { setSending(false); }
  }

  return (
    <Page
      title="Change Request"
      onBack={() => router.back()}
      rightButtons={
        id ? (
          <Pressable
            onPress={() => router.push(`/tools/change-requests/edit/${id}` as never)}
            accessibilityRole="button"
            accessibilityLabel="Edit change request"
            className="h-11 w-11 items-center justify-center rounded-full active:bg-white/20"
          >
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          </Pressable>
        ) : null
      }
      scroll
      footer={
        id && !id.startsWith("local_") ? (
          <View className="flex-row items-end gap-2">
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Add a comment"
              placeholderTextColor="#ADADAD"
              multiline
              className="max-h-28 min-h-12 flex-1 rounded-xl bg-surface-alt px-4 py-3 font-jakarta text-base text-black-500"
            />
            <Pressable
              onPress={handleSend}
              disabled={!body.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Send comment"
              className={cn("h-12 w-12 items-center justify-center rounded-xl bg-primary-500", (!body.trim() || sending) && "opacity-50")}
            >
              {sending ? <Spinner size="xs" tone="current" /> : <Ionicons name="arrow-up" size={20} color="#FFFFFF" />}
            </Pressable>
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

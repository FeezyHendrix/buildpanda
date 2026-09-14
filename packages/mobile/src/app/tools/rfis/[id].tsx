import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { RFI_RESPONDABLE_STATUSES, type RfiStatusTransition } from "@/api/rfis";
import { Button, Card, PendingBadge, Spinner, Text } from "@/components/atoms";
import { ICON_BRAND, ICON_MUTED } from "@/constants/colors";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
import { RfiDetailHeader } from "@/components/molecules/rfi-detail-header";
import { RfiStatusActions } from "@/components/molecules/rfi-status-actions";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import type { LocalRfi } from "@/db/rfis-repository";
import { useAddRfiComment, useRfiComments, type LocalRfiComment } from "@/hooks/use-rfi-comments";
import { useLocalRfi, useTransitionLocalRfi } from "@/hooks/use-local-rfis";
import { useSession } from "@/lib/auth-client";
import { formatDateTime } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
import { htmlToText } from "@/lib/html";

/**
 * The reply that is the official answer. The server does not flag it, so it
 * is the newest reply whose text is the RFI's official response — or one
 * still queued from this device, which is flagged locally.
 */
function findOfficialComment(rfi: LocalRfi, comments: readonly LocalRfiComment[]): LocalRfiComment | null {
  const matches = comments.filter((c) => c.official || (rfi.officialResponse !== null && c.body === rfi.officialResponse));
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

function CommentThread({
  comments,
  isPending,
  officialId,
}: {
  comments: readonly LocalRfiComment[];
  isPending: boolean;
  officialId: string | null;
}) {
  if (isPending) {
    return (
      <View className="items-center py-8">
        <Spinner size="md" />
      </View>
    );
  }

  if (comments.length === 0) {
    return (
      <View className="items-center py-8">
        <Text tone="secondary" className="px-6 text-center text-[13px]">
          No responses yet. Add a comment below, or post the official answer once you have it.
        </Text>
      </View>
    );
  }

  return (
    <Card>
      {comments.map((comment) => (
        <View key={comment.id} className="border-b border-hairline px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Text weight="semibold" className="flex-1 text-[13px]" numberOfLines={1}>
              {comment.authorName || "You"}
            </Text>
            {comment.id === officialId ? (
              <View className="rounded-full bg-primary-50 px-2 py-0.5">
                <Text weight="semibold" tone="brand" className="text-[10px] uppercase">
                  Official
                </Text>
              </View>
            ) : null}
            {comment.isPendingSync ? (
              <PendingBadge />
            ) : (
              <Text tone="muted" className="text-[11px]">
                {formatDateTime(comment.createdAt)}
              </Text>
            )}
          </View>
          <Text className="pt-1 text-[15px]">{comment.body}</Text>
        </View>
      ))}
    </Card>
  );
}

function OfficialToggle({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      className="min-h-11 flex-row items-center gap-2 px-1"
    >
      <Ionicons name={value ? "checkbox" : "square-outline"} size={22} color={value ? ICON_BRAND : ICON_MUTED} />
      <Text weight={value ? "semibold" : "regular"} className="text-[13px]">
        Mark as official response
      </Text>
    </Pressable>
  );
}

function RfiDetailScreen({ db, projectId, rfiId }: { db: Db; projectId: string; rfiId: string }) {
  const { data: rfi } = useLocalRfi(db, rfiId);
  const { data: comments, isPending: commentsPending } = useRfiComments(db, projectId, rfiId);
  const { data: session } = useSession();
  const addComment = useAddRfiComment(db, projectId);
  const transition = useTransitionLocalRfi();

  const [bodyHtml, setBodyHtml] = useState("");
  const [official, setOfficial] = useState(false);
  const [sending, setSending] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyText = htmlToText(bodyHtml);
  const canSend = bodyText.length > 0 && !sending;
  const canRespondOfficially = rfi ? RFI_RESPONDABLE_STATUSES.includes(rfi.status) : false;
  const postOfficial = official && canRespondOfficially;

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await addComment(rfiId, bodyText, session?.user.name ?? "You", bodyHtml.trim() || null, postOfficial);
      setBodyHtml("");
      setOfficial(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that comment.");
    } finally {
      setSending(false);
    }
  }

  async function handleTransition(status: RfiStatusTransition) {
    setTransitioning(true);
    setError(null);
    try {
      await transition(rfiId, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the status.");
    } finally {
      setTransitioning(false);
    }
  }

  const officialComment = rfi ? findOfficialComment(rfi, comments) : null;

  return (
    <Page
      title="RFI"
      onBack={() => router.back()}
      rightButtons={
        <HeaderIconButton
          icon="create-outline"
          label="Edit RFI"
          onPress={() => router.push(`/tools/rfis/edit/${rfiId}` as never)}
        />
      }
      scroll
      footer={
        <View className="gap-2">
          {error ? (
            <Text tone="danger" className="text-xs">
              {error}
            </Text>
          ) : null}
          <RichTextEditor
            value={bodyHtml}
            onChange={setBodyHtml}
            placeholder={postOfficial ? "Write the official response" : "Add a comment"}
            projectId={projectId}
          />
          {canRespondOfficially ? <OfficialToggle value={official} onChange={setOfficial} /> : null}
          <Button
            onPress={handleSend}
            disabled={!canSend}
            loading={sending}
            accessibilityLabel={postOfficial ? "Post official response" : "Send comment"}
          >
            {postOfficial ? "Post official response" : "Send response"}
          </Button>
        </View>
      }
    >
      {rfi ? (
        <View className="gap-6">
          <RfiDetailHeader
            number={rfi.number}
            subject={rfi.subject}
            question={rfi.question}
            status={rfi.status}
            priority={rfi.priority}
            ballInCourtName={rfi.ballInCourtName}
            dueDate={rfi.dueDate}
            costImpact={rfi.costImpact}
            scheduleImpact={rfi.scheduleImpact}
            officialResponse={rfi.officialResponse}
            officialRespondedByName={officialComment?.authorName ?? null}
            officialRespondedAt={officialComment?.createdAt ?? null}
            officialResponsePending={officialComment?.isPendingSync ?? false}
          />

          <RfiStatusActions
            status={rfi.status}
            notYetOnServer={rfi.id.startsWith("local_")}
            busy={transitioning}
            onTransition={handleTransition}
          />

          <View>
            <Text weight="bold" className="pb-2 text-base">
              Responses & comments
            </Text>
            <CommentThread
              comments={comments}
              isPending={commentsPending}
              officialId={officialComment?.id ?? null}
            />
          </View>
        </View>
      ) : (
        <View className="items-center py-12">
          <Text tone="secondary" className="text-[13px]">
            This RFI may not have synced yet.
          </Text>
        </View>
      )}
    </Page>
  );
}

export default function RfiDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  if (!(ready && db && projectId && id)) {
    return (
      <Page title="RFI" onBack={() => router.back()}>
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      </Page>
    );
  }
  return <RfiDetailScreen db={db} projectId={projectId} rfiId={id} />;
}

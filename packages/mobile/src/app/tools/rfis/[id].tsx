import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import type { RfiPriority, RfiStatus } from "@/api/rfis";
import { Card, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useAddRfiComment, useRfiComments } from "@/hooks/use-rfi-comments";
import { useLocalRfis } from "@/hooks/use-local-rfis";
import { useSession } from "@/lib/auth-client";
import { useFieldSession } from "@/lib/field-session";
import { htmlToText } from "@/lib/html";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<RfiStatus, { bg: string; text: string }> = {
  Draft: { bg: "bg-grey-50", text: "text-grey-500" },
  Open: { bg: "bg-primary-50", text: "text-primary-700" },
  InReview: { bg: "bg-[#FFF3DE]", text: "text-[#8E6B00]" },
  Answered: { bg: "bg-success-50", text: "text-success-700" },
  Closed: { bg: "bg-grey-50", text: "text-grey-500" },
  Void: { bg: "bg-error-50", text: "text-error-600" },
};

function timeLabel(ms: number | string): string {
  const date = typeof ms === "string" ? new Date(ms) : new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: RfiStatus }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.Draft;
  return (
    <View className={cn("rounded-full px-2.5 py-1", tone.bg)}>
      <Text weight="semibold" className={cn("text-[11px] uppercase", tone.text)}>
        {status}
      </Text>
    </View>
  );
}

function PriorityBadge({ priority }: { priority: RfiPriority }) {
  if (priority !== "High") return null;
  return (
    <View className="rounded-full bg-error-50 px-2.5 py-1">
      <Text weight="semibold" tone="danger" className="text-[11px] uppercase">
        High priority
      </Text>
    </View>
  );
}

function RfiHeader({
  number,
  subject,
  question,
  status,
  priority,
  ballInCourtName,
  dueDate,
  officialResponse,
  officialRespondedByName,
  officialRespondedAt,
}: {
  number: number;
  subject: string;
  question: string;
  status: RfiStatus;
  priority: RfiPriority;
  ballInCourtName: string | null;
  dueDate: string | null;
  officialResponse: string | null;
  officialRespondedByName?: string | null;
  officialRespondedAt?: string | null;
}) {
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text weight="semibold" tone="muted" className="text-xs">
          RFI-{number}
        </Text>
        <StatusBadge status={status} />
        <PriorityBadge priority={priority} />
      </View>

      <Text weight="bold" className="text-lg">
        {subject}
      </Text>
      <Text tone="secondary" className="text-[15px]">
        {question}
      </Text>

      {ballInCourtName ? (
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="person-outline" size={14} color="#717171" />
          <Text tone="secondary" className="text-xs">
            Ball in court: {ballInCourtName}
          </Text>
        </View>
      ) : null}

      {dueDate ? (
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="calendar-outline" size={14} color="#717171" />
          <Text tone="secondary" className="text-xs">
            Due {timeLabel(dueDate)}
          </Text>
        </View>
      ) : null}

      {officialResponse ? (
        <View className="rounded-xl bg-primary-50 p-3">
          <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">
            Official response
          </Text>
          <Text className="pt-1.5 text-[15px]">{officialResponse}</Text>
          {officialRespondedByName ? (
            <Text tone="muted" className="pt-1 text-xs">
              {officialRespondedByName}
              {officialRespondedAt ? ` · ${timeLabel(officialRespondedAt)}` : ""}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function CommentThread({ db, projectId, rfiId }: { db: Db; projectId: string; rfiId: string }) {
  const { data, isPending } = useRfiComments(db, projectId, rfiId);

  if (isPending) {
    return (
      <View className="items-center py-8">
        <Spinner size="md" />
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View className="items-center py-8">
        <Text tone="secondary" className="text-[13px]">
          No responses yet.
        </Text>
      </View>
    );
  }

  return (
    <Card>
      {data.map((comment) => (
        <View key={comment.id} className="border-b border-hairline px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Text weight="semibold" className="flex-1 text-[13px]" numberOfLines={1}>
              {comment.authorName || "You"}
            </Text>
            {comment.isPendingSync ? (
              <View className="flex-row items-center gap-1 rounded-full bg-surface-alt px-2 py-0.5">
                <Ionicons name="cloud-upload-outline" size={11} color="#717171" />
                <Text weight="semibold" tone="secondary" className="text-[10px] uppercase">
                  Pending
                </Text>
              </View>
            ) : (
              <Text tone="muted" className="text-[11px]">
                {timeLabel(comment.createdAt)}
              </Text>
            )}
          </View>
          <Text className="pt-1 text-[15px]">{comment.body}</Text>
        </View>
      ))}
    </Card>
  );
}

function RfiDetailContent({ db, projectId, rfiId }: { db: Db; projectId: string; rfiId: string }) {
  const { data: rfis } = useLocalRfis(db, projectId);
  const rfi = rfis.find((r) => r.id === rfiId);

  if (!rfi) {
    return (
      <View className="items-center py-12">
        <Text tone="secondary" className="text-[13px]">
          This RFI may not have synced yet.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-6">
      <RfiHeader
        number={rfi.number}
        subject={rfi.subject}
        question={rfi.question}
        status={rfi.status}
        priority={rfi.priority}
        ballInCourtName={rfi.ballInCourtName}
        dueDate={rfi.dueDate}
        officialResponse={rfi.officialResponse}
      />

      <View>
        <Text weight="bold" className="pb-2 text-base">
          Responses & comments
        </Text>
        <CommentThread db={db} projectId={projectId} rfiId={rfiId} />
      </View>
    </View>
  );
}

export default function RfiDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const { data: session } = useSession();
  const addComment = useAddRfiComment(db, projectId);

  const [bodyHtml, setBodyHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyText = htmlToText(bodyHtml);
  const canSend = bodyText.length > 0 && !sending;

  async function handleSend() {
    if (!canSend || !id) return;
    setSending(true);
    setError(null);
    try {
      await addComment(id, bodyText, session?.user.name ?? "You", bodyHtml.trim() || null);
      setBodyHtml("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that comment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Page
      title="RFI"
      onBack={() => router.back()}
      scroll
      footer={
        <View className="gap-2">
          {error ? (
            <Text tone="danger" className="text-xs">
              {error}
            </Text>
          ) : null}
          <View className="gap-2">
            <RichTextEditor
              value={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Add a comment"
              projectId={projectId}
            />
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send comment"
              accessibilityState={{ disabled: !canSend, busy: sending }}
              className={cn(
                "min-h-12 items-center justify-center rounded-xl bg-primary-500",
                !canSend && "opacity-50",
              )}
            >
              {sending ? (
                <Spinner size="xs" tone="current" />
              ) : (
                <Text weight="semibold" tone="inverse" className="text-[15px]">
                  Send response
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      }
    >
      {ready && db && projectId && id ? (
        <RfiDetailContent db={db} projectId={projectId} rfiId={id} />
      ) : (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      )}
    </Page>
  );
}

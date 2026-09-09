import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import type { ApprovalStatus } from "@/api/material-approvals";
import { Button, Field, Spinner, Text } from "@/components/atoms";
import { MaterialApprovalDetailBody } from "@/components/molecules/material-approval-detail-body";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import type { LocalMaterialApproval } from "@/db/material-approvals-repository";
import { useLocalDb } from "@/db/provider";
import {
  useAddMaterialApprovalComment,
  useDecideMaterialApproval,
  useLocalMaterialApproval,
  useLocalMaterialApprovalComments,
} from "@/hooks/use-material-approvals";
import { useSession } from "@/lib/auth-client";
import { useFieldSession } from "@/lib/field-session";
import { cn } from "@/lib/utils";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Decisions are written locally and queued, so the button does not wait on the
 * network and no permission is guessed at here. The backend remains the only
 * authority: `materials:approve` and the named-reviewer rule are enforced when
 * the outbox pushes, and a refusal surfaces on the sync screen as a failed item
 * rather than being pre-empted from `accountType`.
 */
function DecisionPanel({
  db,
  approval,
  projectId,
}: {
  db: Db;
  approval: LocalMaterialApproval;
  projectId: string;
}) {
  const decide = useDecideMaterialApproval(db, projectId);
  const { data: session } = useSession();
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ApprovalStatus | null>(null);

  if (approval.status !== "Pending" && approval.status !== "Resubmit") return null;

  async function record(status: ApprovalStatus) {
    setError(null);
    setBusy(status);
    try {
      await decide(approval.id, {
        status,
        response: response.trim() || null,
        reviewerName: session?.user.name ?? null,
      });
      setResponse("");
    } catch (err) {
      setError(errorMessage(err, "Could not save that decision."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View className="gap-3 rounded-2xl border border-grey-50 bg-white p-4">
      <Text weight="bold" className="text-base">
        Record a decision
      </Text>

      {error ? (
        <View className="rounded-xl bg-error-50 px-3 py-2">
          <Text tone="danger" className="text-[13px]">
            {error}
          </Text>
        </View>
      ) : null}

      <Field
        label="Decision note (optional)"
        value={response}
        onChangeText={setResponse}
        placeholder="Conditions, or what needs to change"
        multiline
        className="min-h-20"
      />

      <Button onPress={() => void record("Approved")} loading={busy === "Approved"} disabled={busy !== null}>
        Approve
      </Button>
      <Button
        variant="secondary"
        onPress={() => void record("Resubmit")}
        loading={busy === "Resubmit"}
        disabled={busy !== null}
      >
        Request changes
      </Button>
      <Button
        variant="danger"
        onPress={() => void record("Rejected")}
        loading={busy === "Rejected"}
        disabled={busy !== null}
      >
        Reject
      </Button>

      {approval.status === "Resubmit" ? (
        <Button
          variant="ghost"
          onPress={() => void record("Pending")}
          loading={busy === "Pending"}
          disabled={busy !== null}
        >
          Send back for review
        </Button>
      ) : null}
    </View>
  );
}

function CommentComposer({
  db,
  projectId,
  approvalId,
}: {
  db: Db;
  projectId: string;
  approvalId: string;
}) {
  const addComment = useAddMaterialApprovalComment(db, projectId);
  const { data: session } = useSession();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSend = body.trim().length > 0 && !sending;

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await addComment({
        approvalId,
        body: body.trim(),
        authorName: session?.user.name ?? "You",
      });
      setBody("");
    } catch (err) {
      setError(errorMessage(err, "Could not save that comment."));
    } finally {
      setSending(false);
    }
  }

  return (
    <View className="gap-2">
      {error ? (
        <Text tone="danger" className="text-xs">
          {error}
        </Text>
      ) : null}
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
          onPress={() => void handleSend()}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send comment"
          accessibilityState={{ disabled: !canSend, busy: sending }}
          className={cn(
            "h-14 w-14 items-center justify-center rounded-xl bg-primary-500",
            !canSend && "opacity-50",
          )}
        >
          {sending ? (
            <Spinner size="xs" tone="current" />
          ) : (
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function DetailContent({
  db,
  projectId,
  approvalId,
}: {
  db: Db;
  projectId: string;
  approvalId: string;
}) {
  const { approval, isPending } = useLocalMaterialApproval(db, projectId, approvalId);
  const comments = useLocalMaterialApprovalComments(db, projectId, approvalId);

  if (isPending) {
    return (
      <View className="items-center py-12">
        <Spinner size="md" />
      </View>
    );
  }

  if (!approval) {
    return (
      <View className="items-center py-12">
        <Text tone="secondary" className="text-[13px]">
          This request may not have synced yet.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-6">
      <MaterialApprovalDetailBody
        approval={approval}
        comments={comments.data}
        commentsPending={comments.isPending}
      />
      <DecisionPanel db={db} approval={approval} projectId={projectId} />
    </View>
  );
}

export default function MaterialApprovalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const isReady = ready && db && projectId && id;

  return (
    <Page
      title="Material Approval"
      onBack={() => router.back()}
      footer={
        isReady ? <CommentComposer db={db} projectId={projectId} approvalId={id} /> : undefined
      }
    >
      {isReady ? (
        <DetailContent db={db} projectId={projectId} approvalId={id} />
      ) : (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      )}
    </Page>
  );
}

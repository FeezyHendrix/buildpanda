import { View } from "react-native";
import { Card, PendingBadge, Spinner, Text } from "@/components/atoms";
import type { LocalMaterialApprovalComment } from "@/db/material-approval-comments-repository";
import type { LocalMaterialApproval } from "@/db/material-approvals-repository";
import { formatDateTime, formatShortDate } from "@/lib/dates";
import { MaterialApprovalStatusBadge } from "./material-approval-status";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[45%] flex-1">
      <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">
        {label}
      </Text>
      <Text weight="medium" className="pt-0.5 text-[15px]">
        {value}
      </Text>
    </View>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View>
      <Text weight="bold" className="pb-1.5 text-base">
        {title}
      </Text>
      <Text tone="secondary" className="text-[15px]">
        {body}
      </Text>
    </View>
  );
}

function CommentThread({
  comments,
  isPending,
}: {
  comments: readonly LocalMaterialApprovalComment[];
  isPending: boolean;
}) {
  if (isPending) {
    return (
      <View className="items-center py-6">
        <Spinner size="md" />
      </View>
    );
  }

  if (comments.length === 0) {
    return (
      <Text tone="secondary" className="px-6 py-4 text-center text-[13px]">
        No comments yet. Add one below — it is saved on your device and uploads when you have signal.
      </Text>
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

export function MaterialApprovalDetailBody({
  approval,
  comments,
  commentsPending,
}: {
  approval: LocalMaterialApproval;
  comments: readonly LocalMaterialApprovalComment[];
  commentsPending: boolean;
}) {
  const neededBy = formatShortDate(approval.neededBy);

  return (
    <View className="gap-6">
      <View className="gap-3">
        <View className="flex-row flex-wrap items-center gap-2">
          <MaterialApprovalStatusBadge status={approval.status} />
          {approval.isPendingSync ? <PendingBadge /> : null}
          {approval.requestedReviewerName ? (
            <View className="rounded-full bg-primary-50 px-2.5 py-1">
              <Text weight="semibold" className="text-[11px] uppercase text-primary-700">
                For {approval.requestedReviewerName}
              </Text>
            </View>
          ) : null}
        </View>

        <Text weight="bold" className="text-lg">
          {approval.title}
        </Text>

        <View className="flex-row flex-wrap gap-4">
          <Fact label="Material" value={approval.materialName} />
          <Fact label="Quantity" value={`${approval.quantity} ${approval.unit}`} />
          {approval.supplier ? <Fact label="Supplier" value={approval.supplier} /> : null}
          {neededBy ? <Fact label="Needed by" value={neededBy} /> : null}
          {approval.phaseName ? <Fact label="Phase" value={approval.phaseName} /> : null}
          {approval.activityName ? <Fact label="Activity" value={approval.activityName} /> : null}
        </View>
      </View>

      {approval.specification ? (
        <Section title="Specification" body={approval.specification} />
      ) : null}
      {approval.description ? <Section title="Notes" body={approval.description} /> : null}

      {approval.response || approval.reviewedByName ? (
        <View className="rounded-xl bg-surface-alt p-3">
          <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">
            Decision · {approval.status}
          </Text>
          {approval.response ? (
            <Text className="pt-1.5 text-[15px]">{approval.response}</Text>
          ) : null}
          {approval.reviewedByName ? (
            <Text tone="muted" className="pt-1 text-xs">
              {approval.reviewedByName}
              {approval.reviewedAt ? ` · ${formatDateTime(approval.reviewedAt)}` : ""}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View>
        <Text weight="bold" className="pb-2 text-base">
          Discussion
        </Text>
        <CommentThread comments={comments} isPending={commentsPending} />
      </View>
    </View>
  );
}

MaterialApprovalDetailBody.displayName = "MaterialApprovalDetailBody";

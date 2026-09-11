import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import type { ApprovalStatus } from "@/api/material-approvals";
import { Card, PendingBadge, Spinner, Text } from "@/components/atoms";
import { ICON_FAINT, ICON_MUTED } from "@/constants/colors";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { MaterialApprovalStatusBadge } from "@/components/molecules/material-approval-status";
import { Page } from "@/components/molecules/page";
import { SegmentedTabs, type SegmentedTab } from "@/components/molecules/segmented-tabs";
import type { Db } from "@/db/client";
import type { LocalMaterialApproval } from "@/db/material-approvals-repository";
import { useLocalDb } from "@/db/provider";
import { useLocalMaterialApprovals } from "@/hooks/use-material-approvals";
import { formatShortDate } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";

type Filter = "all" | ApprovalStatus;

const FILTERS: readonly SegmentedTab<Filter>[] = [
  { key: "all", label: "All" },
  { key: "Pending", label: "Pending" },
  { key: "Resubmit", label: "Resubmit" },
  { key: "Approved", label: "Approved" },
  { key: "Rejected", label: "Rejected" },
] as const;

/** Each tab says what it would hold, so an empty one is a fact rather than a puzzle. */
const EMPTY_COPY: Record<Filter, { title: string; body: string }> = {
  all: {
    title: "No material approval requests yet",
    body: "Raise one to get a material and its specification signed off before it is ordered.",
  },
  Pending: {
    title: "Nothing is waiting for a decision",
    body: "Every request on this project has been decided. New requests appear here until a reviewer acts on them.",
  },
  Resubmit: {
    title: "Nothing has been sent back",
    body: "Requests a reviewer asked to be changed and resubmitted appear here.",
  },
  Approved: {
    title: "Nothing has been approved yet",
    body: "Requests appear here once a reviewer signs them off.",
  },
  Rejected: {
    title: "Nothing has been rejected",
    body: "Requests a reviewer turned down appear here.",
  },
};

function facts(approval: LocalMaterialApproval): string {
  const neededBy = formatShortDate(approval.neededBy);
  return [
    `${approval.quantity} ${approval.unit}`,
    approval.supplier,
    neededBy ? `needed ${neededBy}` : null,
    approval.phaseName,
  ]
    .filter(Boolean)
    .join(" · ");
}

function ApprovalRow({ approval }: { approval: LocalMaterialApproval }) {
  return (
    <Pressable
      onPress={() => router.push(`./${approval.id}`)}
      accessibilityRole="button"
      className="min-h-16 gap-1.5 border-b border-hairline px-4 py-3 active:bg-surface-alt"
    >
      <View className="flex-row items-center gap-3">
        <Text weight="semibold" className="min-w-0 flex-1 text-[15px]" numberOfLines={1}>
          {approval.title}
        </Text>
        {approval.isPendingSync ? <PendingBadge /> : <MaterialApprovalStatusBadge status={approval.status} />}
        <Ionicons name="chevron-forward" size={18} color={ICON_FAINT} />
      </View>
      <Text weight="medium" tone="secondary" className="text-[13px]" numberOfLines={1}>
        {approval.materialName}
      </Text>
      <View className="flex-row items-center gap-2">
        <Text tone="muted" className="min-w-0 flex-1 text-xs" numberOfLines={1}>
          {facts(approval)}
        </Text>
        {approval.commentCount > 0 ? (
          <View className="flex-row items-center gap-1">
            <Ionicons name="chatbubble-outline" size={11} color={ICON_MUTED} />
            <Text tone="muted" className="text-xs">
              {approval.commentCount}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function ApprovalList({ db, projectId, filter }: { db: Db; projectId: string; filter: Filter }) {
  const { data, isPending } = useLocalMaterialApprovals(db, projectId);
  const rows = useMemo(
    () => (filter === "all" ? data : data.filter((row) => row.status === filter)),
    [data, filter],
  );

  if (isPending) {
    return (
      <View className="items-center py-12">
        <Spinner size="md" />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View className="items-center py-12">
        <Text weight="semibold" className="text-center text-base">
          {EMPTY_COPY[filter].title}
        </Text>
        <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
          {EMPTY_COPY[filter].body}
        </Text>
      </View>
    );
  }

  return (
    <Card>
      {rows.map((approval) => (
        <ApprovalRow key={approval.id} approval={approval} />
      ))}
    </Card>
  );
}

export default function MaterialApprovals() {
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const [filter, setFilter] = useState<Filter>("all");

  return (
    <Page
      title="Material approvals"
      onBack={() => router.back()}
      rightButtons={
        <HeaderIconButton
          icon="add"
          label="New approval request"
          onPress={() => router.push("./new")}
        />
      }
    >
      <View className="pb-3">
        <SegmentedTabs tabs={FILTERS} active={filter} onChange={setFilter} />
      </View>

      {ready && db && projectId ? (
        <ApprovalList db={db} projectId={projectId} filter={filter} />
      ) : (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      )}
    </Page>
  );
}

import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import type { ApprovalStatus } from "@/api/material-approvals";
import { Card, Spinner, Text } from "@/components/atoms";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import {
  MaterialApprovalStatusBadge,
  shortDate,
} from "@/components/molecules/material-approval-status";
import { Page } from "@/components/molecules/page";
import { SegmentedTabs, type SegmentedTab } from "@/components/molecules/segmented-tabs";
import type { Db } from "@/db/client";
import type { LocalMaterialApproval } from "@/db/material-approvals-repository";
import { useLocalDb } from "@/db/provider";
import { useLocalMaterialApprovals } from "@/hooks/use-material-approvals";
import { useFieldSession } from "@/lib/field-session";

type Filter = "all" | ApprovalStatus;

const FILTERS: readonly SegmentedTab<Filter>[] = [
  { key: "all", label: "All" },
  { key: "Pending", label: "Pending" },
  { key: "Resubmit", label: "Resubmit" },
  { key: "Approved", label: "Approved" },
  { key: "Rejected", label: "Rejected" },
] as const;

function facts(approval: LocalMaterialApproval): string {
  const neededBy = shortDate(approval.neededBy);
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
        {approval.isPendingSync ? (
          <View className="flex-row items-center gap-1 rounded-full bg-surface-alt px-2 py-1">
            <Ionicons name="cloud-upload-outline" size={12} color="#717171" />
            <Text weight="semibold" tone="secondary" className="text-[10px] uppercase">
              Pending
            </Text>
          </View>
        ) : (
          <MaterialApprovalStatusBadge status={approval.status} />
        )}
        <Ionicons name="chevron-forward" size={18} color="#C8C8C8" />
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
            <Ionicons name="chatbubble-outline" size={11} color="#888888" />
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
          {filter === "all" ? "No material approval requests" : `Nothing ${filter.toLowerCase()}`}
        </Text>
        <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
          {filter === "all"
            ? "Raise one to get a material and its specification signed off before it is ordered."
            : "Switch tabs to see the rest of this project's requests."}
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
      title="Material Approvals"
      onBack={() => router.back()}
      rightButtons={
        <HeaderIconButton
          icon="add"
          label="New material approval request"
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

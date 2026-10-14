import { RichContent } from "@/components/rich-text/rich-content";
import { features } from "@/lib/feature-access";
import { withProjectPermission } from "@/components/molecules/permission-gate";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Card, PendingBadge, Spinner, Text } from "@/components/atoms";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
import { SegmentedTabs } from "@/components/molecules/segmented-tabs";
import { ICON_BRAND, ICON_MUTED } from "@/constants/colors";
import type { Db } from "@/db/client";
import type { MaterialLedgerEntryRow, MaterialStockRow } from "@/db/schema";
import { useLocalDb } from "@/db/provider";
import { useMaterialLog } from "@/hooks/use-material-log";
import { useProjectAccess } from "@/hooks/use-project-access";
import { formatDateTime } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
import { goBack } from "@/lib/navigation";
import { matchesStage } from "@/lib/stage-filter";
import { useStageScope } from "@/lib/stage-scope";

type Tab = "log" | "stock";
const TABS = [
  { key: "log", label: "Log" },
  { key: "stock", label: "Stock" },
] as const;

const qty = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

function approvalLabel(row: MaterialLedgerEntryRow): string | null {
  if (row.isPendingSync) return null; // the pending badge says it
  if (row.status === "Voided" || row.entryType === "VOID") return "Voided";
  return row.approvalStatus === "Pending" ? "Awaiting approval" : row.approvalStatus;
}

function EntryRow({ row, first }: { row: MaterialLedgerEntryRow; first: boolean }) {
  const received = row.entryType === "IN";
  const voided = row.status === "Voided" || row.entryType === "VOID";
  return (
    <View className={`min-h-16 flex-row items-center gap-3 px-4 py-3 ${first ? "" : "border-t border-hairline"}`}>
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-surface-alt">
        <Ionicons name={received ? "arrow-down-circle-outline" : row.entryType === "VOID" ? "close-circle-outline" : "arrow-up-circle-outline"} size={20} color={received ? ICON_BRAND : ICON_MUTED} />
      </View>
      <View className="min-w-0 flex-1">
        <Text weight="semibold" className={`text-[15px] ${voided ? "line-through" : ""}`} numberOfLines={1}>
          {received ? "Received" : row.entryType === "VOID" ? "Void" : "Used"} {qty(row.quantity)} {row.unit} {row.materialName}
        </Text>
        <Text tone="secondary" className="pt-0.5 text-xs" numberOfLines={1}>
          {[formatDateTime(row.occurredAt), row.loggedByName, row.stageName, approvalLabel(row)].filter(Boolean).join(" · ")}
        </Text>
        {received ? (
          <Text tone={row.materialOrderTitle ? "secondary" : "muted"} className="pt-0.5 text-xs" numberOfLines={1}>
            {row.materialOrderTitle ? `Order: ${row.materialOrderTitle}` : "Unplanned delivery"}
          </Text>
        ) : null}
        {row.notesHtml ? <RichContent html={row.notesHtml} projectId={row.projectId} /> : null}
      </View>
      {row.isPendingSync ? <PendingBadge /> : null}
    </View>
  );
}

function StockRow({ row, first }: { row: MaterialStockRow; first: boolean }) {
  const short = row.onHandQty < 0 || row.lowStock;
  return (
    <View className={`min-h-14 flex-row items-center gap-3 px-4 py-3 ${first ? "" : "border-t border-hairline"}`}>
      <View className="min-w-0 flex-1">
        <Text weight="semibold" className="text-[15px]" numberOfLines={1}>{row.materialName}</Text>
        {row.locationKey !== "default" ? <Text tone="secondary" className="pt-0.5 text-xs">{row.locationKey}</Text> : null}
      </View>
      <Text weight="semibold" tone={short ? "danger" : undefined} className="text-[15px]">
        {qty(row.onHandQty)} {row.unit}
      </Text>
    </View>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View className="items-center py-12">
      <Text weight="semibold" className="text-center text-base">{title}</Text>
      <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">{body}</Text>
    </View>
  );
}

function Ledger({ db, projectId, tab }: { db: Db; projectId: string; tab: Tab }) {
  const { entries, stock, isPending } = useMaterialLog(db, projectId);
  const { stageId } = useStageScope();
  if (isPending) return <View className="items-center py-12"><Spinner size="md" /></View>;

  if (tab === "stock") {
    return stock.length === 0 ? (
      <Empty title="No stock yet" body="Stock builds up as deliveries are logged and approved." />
    ) : (
      <View className="gap-2">
        <Text tone="secondary" className="text-xs">Received minus used, counting approved entries only.</Text>
        <Card>{stock.map((row, i) => <StockRow key={row.id} row={row} first={i === 0} />)}</Card>
      </View>
    );
  }
  const visible = entries.filter((row) => matchesStage(row.stageId, stageId));
  return visible.length === 0 ? (
    <Empty title="Nothing logged yet" body="Log each delivery as it arrives on site. A manager approves it before it counts in stock." />
  ) : (
    <Card>{visible.map((row, i) => <EntryRow key={row.id} row={row} first={i === 0} />)}</Card>
  );
}

function MaterialLog() {
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const { can } = useProjectAccess();
  const [tab, setTab] = useState<Tab>("log");

  return (
    <Page
      stageScope
      title="Material log"
      onBack={() => goBack()}
      rightButtons={
        can("materials", "request") ? (
          <HeaderIconButton permission={features.materialLog.actions.create} icon="add" label="Log material" onPress={() => router.push("/tools/material-log/new")} />
        ) : undefined
      }
    >
      <View className="gap-4">
        <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />
        {ready && db && projectId ? (
          <Ledger key={projectId} db={db} projectId={projectId} tab={tab} />
        ) : (
          <View className="items-center py-12"><Spinner size="md" /></View>
        )}
      </View>
    </Page>
  );
}

export default withProjectPermission(MaterialLog, "/tools/material-log/index");

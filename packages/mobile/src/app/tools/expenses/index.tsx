import { features } from "@/lib/feature-access";
import { withProjectPermission } from "@/components/molecules/permission-gate";
import { router } from "expo-router";
import { View } from "react-native";
import { Card, PendingBadge, Spinner, Text } from "@/components/atoms";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useExpenses } from "@/hooks/use-expenses";
import { useProjectAccess } from "@/hooks/use-project-access";
import { useProject } from "@/hooks/use-projects";
import { formatShortDate } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
import { formatMoney } from "@/lib/money";
import { goBack } from "@/lib/navigation";
import { matchesStage } from "@/lib/stage-filter";
import { useStageScope } from "@/lib/stage-scope";

function ExpenseList({ db, projectId, currency }: { db: Db; projectId: string; currency: string | undefined }) {
  const { data, isPending } = useExpenses(db, projectId);
  const { stageId } = useStageScope();
  if (isPending) return <View className="items-center py-12"><Spinner size="md" /></View>;

  const visible = data.filter((row) => matchesStage(row.stageId, stageId));
  if (visible.length === 0) {
    return (
      <View className="items-center py-12">
        <Text weight="semibold" className="text-center text-base">No expenses logged</Text>
        <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">Log a site spend with its receipt as it happens, signal or not.</Text>
      </View>
    );
  }
  // A credit or refund comes back against cost, so it counts the other way.
  const total = visible.reduce((sum, row) => sum + (row.credit ? -row.amount : row.amount), 0);

  return (
    <View className="gap-4">
      <Card className="p-4">
        <Text tone="secondary" className="text-xs">Logged {stageId ? "for this stage" : "on this project"}</Text>
        <Text weight="bold" className="pt-1 text-2xl">{formatMoney(total, currency)}</Text>
      </Card>
      <Card>
        {visible.map((row, index) => (
          <View key={row.id} className={`min-h-16 flex-row items-center gap-3 px-4 py-3 ${index ? "border-t border-hairline" : ""}`}>
            <View className="min-w-0 flex-1">
              <Text weight="semibold" className="text-[15px]" numberOfLines={1}>{row.title}</Text>
              <Text tone="secondary" className="pt-0.5 text-xs" numberOfLines={1}>
                {[formatShortDate(row.transactedAt), row.categoryLabel || row.category, row.vendor, row.receiptFileId || row.receiptStagedUri ? "Receipt" : null].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <View className="items-end gap-1">
              <Text weight="semibold" tone={row.credit ? "brand" : undefined} className="text-[15px]">
                {row.credit ? "−" : ""}{formatMoney(row.amount, currency)}
              </Text>
              {row.isPendingSync ? <PendingBadge /> : null}
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

function Expenses() {
  const { projectId } = useFieldSession();
  const project = useProject(projectId);
  const { db, ready } = useLocalDb();
  const { allows } = useProjectAccess();

  return (
    <Page
      stageScope
      title="Expenses"
      onBack={() => goBack()}
      rightButtons={allows(features.expenses.actions.create) ? <HeaderIconButton permission={features.expenses.actions.create} icon="add" label="Log expense" onPress={() => router.push("/tools/expenses/new")} /> : undefined}
    >
      {ready && db && projectId ? (
        <ExpenseList key={projectId} db={db} projectId={projectId} currency={project.data?.currency} />
      ) : (
        <View className="items-center py-12"><Spinner size="md" /></View>
      )}
    </Page>
  );
}

export default withProjectPermission(Expenses, "/tools/expenses/index");

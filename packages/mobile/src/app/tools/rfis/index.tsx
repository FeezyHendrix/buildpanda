import { goBack } from "@/lib/navigation";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { RFI_STATUS_LABELS, type RfiPriority } from "@/api/rfis";
import type { LocalRfi } from "@/db/rfis-repository";
import { PendingBadge, Spinner, Text } from "@/components/atoms";
import { ICON_FAINT } from "@/constants/colors";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
import { SearchableList } from "@/components/molecules/searchable-list";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useLocalRfis } from "@/hooks/use-local-rfis";
import { useFieldSession } from "@/lib/field-session";
import { cn } from "@/lib/utils";

const PRIORITY_TONE: Record<RfiPriority, string> = {
  High: "bg-error-50",
  Normal: "bg-surface-alt",
  Low: "bg-surface-alt",
};

function RfiRow({ rfi }: { rfi: LocalRfi }) {
  return (
    <Pressable
      onPress={() => router.push(`/tools/rfis/${rfi.id}`)}
      accessibilityRole="button"
      className="min-h-16 flex-row items-center gap-3 border-b border-hairline px-4 py-3 active:bg-surface-alt"
    >
      <View className="min-w-0 flex-1">
        <Text weight="semibold" className="text-[15px]" numberOfLines={1}>
          {rfi.number > 0 ? `#${rfi.number} · ` : ""}
          {rfi.subject}
        </Text>
        <Text tone="secondary" className="pt-0.5 text-xs" numberOfLines={1}>
          {RFI_STATUS_LABELS[rfi.status]}
          {rfi.ballInCourtName ? ` · Ball in court: ${rfi.ballInCourtName}` : ""}
        </Text>
      </View>

      {rfi.isPendingSync ? (
        <PendingBadge />
      ) : (
        <View className={cn("rounded-full px-2 py-1", PRIORITY_TONE[rfi.priority])}>
          <Text
            weight="semibold"
            tone={rfi.priority === "High" ? "danger" : "secondary"}
            className="text-[10px] uppercase"
          >
            {rfi.priority}
          </Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={ICON_FAINT} />
    </Pressable>
  );
}

/** Split out so the live query only mounts once the database is open. */
function RfiList({ db, projectId }: { db: Db; projectId: string }) {
  const { data, isPending } = useLocalRfis(db, projectId);
  return (
    <SearchableList
      data={data}
      loading={isPending}
      fields={(row) => [
        row.subject,
        row.number > 0 ? `#${row.number}` : null,
        RFI_STATUS_LABELS[row.status],
        row.ballInCourtName,
        row.priority,
      ]}
      placeholder="Search RFIs"
      emptyTitle="No RFIs yet"
      emptyBody="Raise one when site needs an answer before work can continue."
      renderItem={(row) => <RfiRow rfi={row} />}
    />
  );
}

export default function Rfis() {
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  return (
    <Page
      scroll={false}
      title="RFIs"
      onBack={() => goBack()}
      rightButtons={
        <HeaderIconButton
          icon="add"
          label="New RFI"
          onPress={() => router.push("/tools/rfis/new")}
        />
      }
    >
      {ready && db && projectId ? (
        <RfiList key={projectId} db={db} projectId={projectId} />
      ) : (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      )}
    </Page>
  );
}

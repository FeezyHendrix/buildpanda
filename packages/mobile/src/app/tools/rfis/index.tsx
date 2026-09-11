import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { RFI_STATUS_LABELS, type RfiPriority } from "@/api/rfis";
import type { LocalRfi } from "@/db/rfis-repository";
import { Card, PendingBadge, Spinner, Text } from "@/components/atoms";
import { ICON_FAINT } from "@/constants/colors";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
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

  if (isPending) {
    return (
      <View className="items-center py-12">
        <Spinner size="md" />
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View className="items-center py-12">
        <Text weight="semibold" className="text-center text-base">
          No RFIs yet
        </Text>
        <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
          Raise one when site needs an answer before work can continue.
        </Text>
      </View>
    );
  }

  return (
    <Card>
      {data.map((rfi) => (
        <RfiRow key={rfi.id} rfi={rfi} />
      ))}
    </Card>
  );
}

export default function Rfis() {
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  return (
    <Page
      title="RFIs"
      onBack={() => router.back()}
      rightButtons={
        <HeaderIconButton icon="add" label="New RFI" onPress={() => router.push("/tools/rfis/new")} />
      }
    >
      {ready && db && projectId ? (
        <RfiList db={db} projectId={projectId} />
      ) : (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      )}
    </Page>
  );
}

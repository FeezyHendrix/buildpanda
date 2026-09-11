import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { materialOrderStatusLabel } from "@/api/materials";
import { Card, PendingBadge, Spinner, Text } from "@/components/atoms";
import { ICON_FAINT } from "@/constants/colors";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useLocalMaterialOrders } from "@/hooks/use-local-materials";
import { useFieldSession } from "@/lib/field-session";

function List({ db, projectId }: { db: Db; projectId: string }) {
  const { data, isPending } = useLocalMaterialOrders(db, projectId);

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
          No material orders yet
        </Text>
        <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
          Raise a request when site needs materials.
        </Text>
      </View>
    );
  }

  return (
    <Card>
      {data.map((row) => (
        <Pressable
          key={row.id}
          onPress={() => router.push(`/tools/materials/${row.id}`)}
          accessibilityRole="button"
          className="min-h-16 flex-row items-center gap-3 border-b border-hairline px-4 py-3 active:bg-surface-alt"
        >
          <View className="min-w-0 flex-1">
            <Text weight="semibold" className="text-[15px]" numberOfLines={1}>
              {row.title || row.materialName}
            </Text>
            <Text tone="secondary" className="pt-0.5 text-xs" numberOfLines={1}>
              {[`${row.quantity} ${row.unit}`, row.supplier, materialOrderStatusLabel(row.status)].filter(Boolean).join(" · ")}
            </Text>
          </View>
          {row.isPendingSync ? <PendingBadge /> : null}
          <Ionicons name="chevron-forward" size={18} color={ICON_FAINT} />
        </Pressable>
      ))}
    </Card>
  );
}

export default function Materials() {
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  return (
    <Page
      title="Materials"
      onBack={() => router.back()}
      rightButtons={
        <HeaderIconButton icon="add" label="New material order" onPress={() => router.push("/tools/materials/new")} />
      }
    >
      {ready && db && projectId ? (
        <List db={db} projectId={projectId} />
      ) : (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      )}
    </Page>
  );
}

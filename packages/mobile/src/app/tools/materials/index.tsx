import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Card, Spinner, Text } from "@/components/atoms";
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
          No material orders
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
        <View
          key={row.id}
          className="min-h-16 flex-row items-center gap-3 border-b border-hairline px-4 py-3"
        >
          <View className="min-w-0 flex-1">
            <Text weight="semibold" className="text-[15px]" numberOfLines={1}>
              {row.title || row.materialName}
            </Text>
            <Text tone="secondary" className="pt-0.5 text-xs" numberOfLines={1}>
              {[`${row.quantity} ${row.unit}`, row.supplier, row.status].filter(Boolean).join(" · ")}
            </Text>
          </View>
          {row.isPendingSync ? (
            <Ionicons name="cloud-upload-outline" size={16} color="#717171" />
          ) : null}
        </View>
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

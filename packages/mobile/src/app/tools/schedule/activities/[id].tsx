import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";
import { Spinner, Text } from "@/components/atoms";
import { DetailFields } from "@/components/molecules/schedule/detail-fields";
import { Page } from "@/components/molecules/page";
import { useActivities } from "@/hooks/use-activities";
import { useFieldSession } from "@/lib/field-session";

export default function ActivityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const query = useActivities(projectId);

  const record = useMemo(
    () => (query.data ?? []).find((row) => row.id === id),
    [query.data, id],
  );

  return (
    <Page title="Activity" onBack={() => router.back()}>
      {query.isPending && !record ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : record ? (
        <View className="gap-4">
          <Text weight="bold" className="text-lg">
            {record.name}
          </Text>
          <DetailFields fields={[
              { label: "Status", value: record.isDelayed ? `${record.status} · delayed` : record.status },
              { label: "Phase", value: record.phaseName },
              { label: "Location", value: record.location },
              { label: "Planned start", value: record.plannedStartAt },
              { label: "Planned end", value: record.plannedEndAt },
            ]} />
        </View>
      ) : (
        <View className="items-center py-12">
          <Text tone="secondary" className="text-[13px]">
            This record is no longer available.
          </Text>
        </View>
      )}
    </Page>
  );
}

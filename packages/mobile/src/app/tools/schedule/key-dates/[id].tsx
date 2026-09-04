import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";
import { Spinner, Text } from "@/components/atoms";
import { DetailFields } from "@/components/molecules/schedule/detail-fields";
import { Page } from "@/components/molecules/page";
import { useKeyDates } from "@/hooks/use-key-dates";
import { useFieldSession } from "@/lib/field-session";

export default function KeyDateDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const query = useKeyDates(projectId);

  const record = useMemo(
    () => (query.data ?? []).find((row) => row.id === id),
    [query.data, id],
  );

  return (
    <Page title="Key Date" onBack={() => router.back()}>
      {query.isPending && !record ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : record ? (
        <View className="gap-4">
          <Text weight="bold" className="text-lg">
            {record.label}
          </Text>
          <DetailFields fields={[
              { label: "Status", value: record.status },
              { label: "Target date", value: record.targetDate },
              { label: "Actual date", value: record.actualDate },
              { label: "Notes", value: record.notes },
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

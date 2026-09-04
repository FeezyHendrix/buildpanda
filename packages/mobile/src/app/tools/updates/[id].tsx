import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";
import { Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { UpdateCard } from "@/components/molecules/update-card";
import { useProjectUpdates } from "@/hooks/use-updates";
import { useFieldSession } from "@/lib/field-session";

export default function UpdateDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { data, isPending } = useProjectUpdates(projectId);

  const update = useMemo(() => (data ?? []).find((row) => row.id === id), [data, id]);

  return (
    <Page title="Update" onBack={() => router.back()}>
      {isPending && !update ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : update ? (
        <UpdateCard update={update} expanded />
      ) : (
        <View className="items-center py-12">
          <Text tone="secondary" className="text-[13px]">
            This update is no longer available.
          </Text>
        </View>
      )}
    </Page>
  );
}

import { withProjectPermission } from "@/components/molecules/permission-gate";
import { goBack } from "@/lib/navigation";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { UpdateCard } from "@/components/molecules/update-card";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useProjectUpdate } from "@/hooks/use-updates";
import { useFieldSession } from "@/lib/field-session";

function UpdateBody({ db, projectId, id }: { db: Db; projectId: string; id: string }) {
  const { update, isPending } = useProjectUpdate(db, projectId, id);

  if (isPending && !update) {
    return (
      <View className="items-center py-12">
        <Spinner size="md" />
      </View>
    );
  }
  if (!update) {
    return (
      <View className="items-center py-12">
        <Text tone="secondary" className="text-[13px]">
          This update is no longer available.
        </Text>
      </View>
    );
  }
  return <UpdateCard update={update} expanded />;
}

function UpdateDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  return (
    <Page title="Update" onBack={() => goBack()}>
      {ready && db && projectId && id ? (
        <UpdateBody db={db} projectId={projectId} id={id} />
      ) : (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      )}
    </Page>
  );
}

export default withProjectPermission(UpdateDetail, "/tools/updates/[id]");

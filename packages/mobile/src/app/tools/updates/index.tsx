import { goBack } from "@/lib/navigation";
import { router } from "expo-router";
import { View } from "react-native";
import { Spinner } from "@/components/atoms";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
import { SearchableList } from "@/components/molecules/searchable-list";
import { UpdateCard } from "@/components/molecules/update-card";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useProjectUpdates } from "@/hooks/use-updates";
import { useFieldSession } from "@/lib/field-session";

function UpdatesList({ db, projectId }: { db: Db; projectId: string }) {
  const { data, isPending } = useProjectUpdates(db, projectId);

  return (
    <SearchableList
      data={data}
      loading={isPending}
      cards
      fields={(update) => [update.title, update.description, update.author.name, update.category]}
      placeholder="Search updates"
      emptyTitle="No updates yet"
      emptyBody="Posted project updates appear here. Add one to report progress, a delivery, an inspection or an issue from site."
      renderItem={(update) => (
        <UpdateCard
          update={update}
          onPress={() => router.push(`/tools/updates/${update.id}` as never)}
        />
      )}
    />
  );
}

export default function ProjectUpdates() {
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();

  return (
    <Page
      scroll={false}
      title="Updates"
      onBack={() => goBack()}
      rightButtons={
        <HeaderIconButton icon="add" label="New update" onPress={() => router.push("./new")} />
      }
    >
      {ready && db && projectId ? (
        <UpdatesList key={projectId} db={db} projectId={projectId} />
      ) : (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      )}
    </Page>
  );
}

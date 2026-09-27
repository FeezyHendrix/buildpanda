import { goBack } from "@/lib/navigation";
import { router } from "expo-router";
import { Page } from "@/components/molecules/page";
import { SearchableList } from "@/components/molecules/searchable-list";
import { StaleBanner } from "@/components/molecules/stale-banner";
import { UpdateCard } from "@/components/molecules/update-card";
import { useProjectUpdates } from "@/hooks/use-updates";
import { useFieldSession } from "@/lib/field-session";

export default function ProjectUpdates() {
  const { projectId } = useFieldSession();
  const { data, isPending, isStale } = useProjectUpdates(projectId);
  const updates = data ?? [];

  return (
    <Page scroll={false} title="Updates" onBack={() => goBack()}>
      {isStale ? <StaleBanner what="updates" /> : null}

      <SearchableList
        key={projectId}
        data={updates}
        loading={isPending}
        cards
        fields={(update) => [update.title, update.description, update.author.name, update.category]}
        placeholder="Search updates"
        emptyTitle="No updates yet"
        emptyBody="Published project updates appear here."
        renderItem={(update) => (
          <UpdateCard
            update={update}
            onPress={() => router.push(`/tools/updates/${update.id}` as never)}
          />
        )}
      />
    </Page>
  );
}

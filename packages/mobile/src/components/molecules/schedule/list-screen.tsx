import { router } from "expo-router";
import type { ReactElement } from "react";
import { Page } from "@/components/molecules/page";
import { SearchableList } from "@/components/molecules/searchable-list";
import { StaleBanner } from "@/components/molecules/stale-banner";

export function ScheduleListScreen<T extends { id: string }>({
  title,
  isPending,
  isStale,
  emptyTitle,
  emptyBody,
  data,
  fields,
  renderItem,
}: {
  title: string;
  isPending: boolean;
  isStale: boolean;
  emptyTitle: string;
  emptyBody: string;
  data: readonly T[];
  fields: (row: T) => readonly (string | number | null | undefined)[];
  renderItem: (row: T) => ReactElement;
}) {
  return (
    <Page buildingScope scroll={false} title={title} onBack={() => router.back()}>
      {isStale ? <StaleBanner what="schedule" /> : null}
      <SearchableList
        data={data}
        fields={fields}
        loading={isPending}
        renderItem={renderItem}
        placeholder={`Search ${title.toLowerCase()}`}
        emptyTitle={emptyTitle}
        emptyBody={emptyBody}
      />
    </Page>
  );
}

import { useState } from "react";
import { Card, Spinner, Text } from "@/components/atoms";
import { GanttChart } from "@/components/molecules/schedule/gantt-chart";
import { Page } from "@/components/molecules/page";
import { SearchField } from "@/components/molecules/search-field";
import { StaleBanner } from "@/components/molecules/stale-banner";
import { useActivities } from "@/hooks/use-activities";
import { useFieldSession } from "@/lib/field-session";
import { goBack } from "@/lib/navigation";
import { matchesSearch } from "@/lib/search";

export default function ProjectChart() {
  const { projectId } = useFieldSession();
  const activities = useActivities(projectId);
  const [query, setQuery] = useState("");
  const data = (activities.data ?? []).filter((activity) =>
    matchesSearch(query, [activity.name, activity.phaseName, activity.location, activity.status]),
  );
  return (
    <Page buildingScope title="Project chart" onBack={goBack}>
      <SearchField value={query} onChange={setQuery} placeholder="Search activities" />
      {activities.isStale ? <StaleBanner what="schedule" /> : null}
      {activities.isPending ? (
        <Spinner />
      ) : data.length > 0 ? (
        <Card>
          <GanttChart activities={data} />
        </Card>
      ) : (
        <Text tone="secondary" className="py-12 text-center">
          {query.trim()
            ? "No activities match your search."
            : "Activities with planned dates will appear here as a timeline."}
        </Text>
      )}
    </Page>
  );
}

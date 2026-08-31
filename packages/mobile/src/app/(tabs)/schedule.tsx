import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Card, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { SegmentedTabs, type SegmentedTab } from "@/components/molecules/segmented-tabs";
import {
  ActivityRow,
  KeyDateRow,
  LookAheadRow,
  StageRow,
} from "@/components/molecules/schedule/rows";
import { GanttChart } from "@/components/molecules/schedule/gantt-chart";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useActivities } from "@/hooks/use-activities";
import { useKeyDates } from "@/hooks/use-key-dates";
import { useLocalLookAheads } from "@/hooks/use-local-look-aheads";
import { useProject } from "@/hooks/use-projects";
import { useStages } from "@/hooks/use-stages";
import { useFieldSession } from "@/lib/field-session";

type ScheduleTab = "activities" | "stages" | "look-aheads" | "key-dates" | "chart";

/** Mirrors the web sidebar's schedule section. */
const TABS: readonly SegmentedTab<ScheduleTab>[] = [
  { key: "activities", label: "Site Activity" },
  { key: "stages", label: "Build Stages" },
  { key: "look-aheads", label: "Look Aheads" },
  { key: "key-dates", label: "Key Dates" },
  { key: "chart", label: "Project Chart" },
] as const;

function Section({
  isPending,
  isStale,
  isEmpty,
  emptyTitle,
  emptyBody,
  children,
}: {
  isPending: boolean;
  isStale: boolean;
  isEmpty: boolean;
  emptyTitle: string;
  emptyBody: string;
  children: ReactNode;
}) {
  if (isPending) {
    return (
      <View className="items-center py-12">
        <Spinner size="md" />
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View className="items-center py-12">
        <Text weight="semibold" className="text-center text-base">
          {emptyTitle}
        </Text>
        <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
          {emptyBody}
        </Text>
      </View>
    );
  }

  return (
    <>
      {isStale ? (
        <Text tone="muted" className="pb-2 text-xs">
          Showing your last synced data — you&apos;re offline.
        </Text>
      ) : null}
      <Card>{children}</Card>
    </>
  );
}

function LookAheadsSection({ db, projectId }: { db: Db; projectId: string }) {
  const { data, isPending } = useLocalLookAheads(db, projectId);

  return (
    <View className="gap-3">
      <Pressable
        onPress={() => router.push("/tools/look-aheads/new")}
        accessibilityRole="button"
        className="min-h-11 flex-row items-center justify-center gap-1.5 self-start rounded-full bg-primary-50 px-4 active:bg-primary-100"
      >
        <Ionicons name="add" size={16} color="#004DE7" />
        <Text weight="semibold" tone="brand" className="text-xs">
          New look ahead
        </Text>
      </Pressable>

      {isPending ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : data.length === 0 ? (
        <View className="items-center py-12">
          <Text weight="semibold" className="text-center text-base">
            No look aheads yet
          </Text>
          <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
            Plan the next stretch of work so the crew knows what's coming.
          </Text>
        </View>
      ) : (
        <Card>
          {data.map((lookAhead) => (
            <LookAheadRow
              key={lookAhead.id}
              lookAhead={lookAhead}
              onPress={() => router.push(`/tools/look-aheads/${lookAhead.id}` as never)}
            />
          ))}
        </Card>
      )}
    </View>
  );
}

export default function Schedule() {
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const [tab, setTab] = useState<ScheduleTab>("activities");

  const { data: project } = useProject(projectId);

  // Each section only fetches while it is the visible tab, so switching tabs
  // doesn't fan out four requests or re-render the inactive lists.
  const activities = useActivities(projectId, tab === "activities" || tab === "chart");
  const stages = useStages(projectId, tab === "stages");
  const keyDates = useKeyDates(projectId, tab === "key-dates");

  return (
    <Page
      title="Schedule"
      projectName={project?.name ?? "Loading project…"}
      onPressProject={() => router.push("/select-project")}
    >
      <View className="pb-3">
        <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />
      </View>

      {tab === "activities" ? (
        <Section
          isPending={activities.isPending}
          isStale={activities.isStale}
          isEmpty={(activities.data ?? []).length === 0}
          emptyTitle="Nothing scheduled"
          emptyBody="Site activities for this project will appear here."
        >
          {(activities.data ?? []).map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))}
        </Section>
      ) : null}

      {tab === "stages" ? (
        <Section
          isPending={stages.isPending}
          isStale={stages.isStale}
          isEmpty={(stages.data ?? []).length === 0}
          emptyTitle="No build stages"
          emptyBody="Stages break the build into phases with their own progress."
        >
          {(stages.data ?? []).map((stage) => (
            <StageRow key={stage.id} stage={stage} />
          ))}
        </Section>
      ) : null}

      {tab === "look-aheads" ? (
        ready && db && projectId ? (
          <LookAheadsSection db={db} projectId={projectId} />
        ) : (
          <View className="items-center py-12">
            <Spinner size="md" />
          </View>
        )
      ) : null}

      {tab === "key-dates" ? (
        <Section
          isPending={keyDates.isPending}
          isStale={keyDates.isStale}
          isEmpty={(keyDates.data ?? []).length === 0}
          emptyTitle="No key dates"
          emptyBody="Milestone and compliance dates for this project will appear here."
        >
          {(keyDates.data ?? []).map((keyDate) => (
            <KeyDateRow key={keyDate.id} keyDate={keyDate} />
          ))}
        </Section>
      ) : null}

      {tab === "chart" ? (
        <Section
          isPending={activities.isPending}
          isStale={activities.isStale}
          isEmpty={(activities.data ?? []).length === 0}
          emptyTitle="Nothing to chart"
          emptyBody="Activities with planned dates will appear here as a timeline."
        >
          <GanttChart activities={activities.data ?? []} />
        </Section>
      ) : null}
    </Page>
  );
}

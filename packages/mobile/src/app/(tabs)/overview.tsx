import { router } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Spinner } from "@/components/atoms";
import { DailyLogCard, MaterialLogCard, SyncNote, TasksCard } from "@/components/home/field-cards";
import { ExpensesCard, ScheduleCard, UpdatesCard } from "@/components/home/project-cards";
import { QuickToolsBar } from "@/components/home/quick-tools-bar";
import { StatCards, type Stat } from "@/components/home/stat-cards";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useHomeSummary } from "@/hooks/use-home-summary";
import { useHomeToolOrder } from "@/hooks/use-home-tools";
import { useProjectBuilding } from "@/hooks/use-project-building";
import { useProject } from "@/hooks/use-projects";
import { useFieldSession } from "@/lib/field-session";
import type { HomeToolKey } from "@/lib/home-tools";

// Home is the app's first screen: the tools this person uses most, what needs
// them today, then a card per tool in the order they use them. Everything is
// read from the phone, so it opens fully with no signal.

function Dashboard({ db, projectId, buildingId }: { db: Db; projectId: string; buildingId: string | undefined }) {
  const { tools, isPending } = useHomeToolOrder(db);
  // tasks and the daily log belong to a building; until one is chosen they sit out
  const summary = useHomeSummary(db, projectId, buildingId ?? "");
  if (isPending) return <View className="items-center py-12"><Spinner size="md" /></View>;

  const keys = tools.map((tool) => tool.key).filter((key) => buildingId || (key !== "tasks" && key !== "dailyLog"));
  const stats: (Stat & { tool: HomeToolKey | null })[] = [
    { tool: "tasks", key: "tasks", label: "My tasks", value: String(summary.myOpen.length), detail: summary.overdue ? `${summary.overdue} overdue` : "None overdue", tone: summary.overdue ? "danger" : undefined, href: "/tools/tasks" },
    { tool: "dailyLog", key: "log", label: "Today's log", value: String(summary.todaysEntries), detail: summary.todaysEntries ? "Entries today" : "Not started", href: "/tools/daily-log" },
    { tool: "materialLog", key: "approval", label: "Awaiting approval", value: String(summary.awaiting), detail: "Deliveries", href: "/tools/material-log" },
    { tool: null, key: "sync", label: "To upload", value: String(summary.toSync + summary.failed), detail: summary.failed ? `${summary.failed} failed` : summary.toSync ? "Waiting for signal" : "All uploaded", tone: summary.failed ? "danger" : undefined, href: "/sync" },
  ];
  const rank = (tool: HomeToolKey | null) => (tool ? keys.indexOf(tool) : keys.length);
  const visibleStats = stats.filter((stat) => stat.tool === null || keys.includes(stat.tool)).sort((a, b) => rank(a.tool) - rank(b.tool));

  const cards: Partial<Record<HomeToolKey, ReactNode>> = {
    ...(buildingId ? {
      dailyLog: <DailyLogCard key="dailyLog" db={db} projectId={projectId} buildingId={buildingId} />,
      tasks: <TasksCard key="tasks" db={db} projectId={projectId} buildingId={buildingId} myOpen={summary.myOpen} />,
    } : {}),
    materialLog: <MaterialLogCard key="materialLog" db={db} projectId={projectId} awaiting={summary.awaiting} />,
    expenses: <ExpensesCard key="expenses" db={db} projectId={projectId} />,
    schedule: <ScheduleCard key="schedule" projectId={projectId} />,
    updates: <UpdatesCard key="updates" db={db} projectId={projectId} />,
  };

  return (
    <View className="gap-4">
      <SyncNote failed={summary.failed} />
      <QuickToolsBar tools={tools} />
      <StatCards stats={visibleStats} />
      {keys.flatMap((key) => cards[key] ?? [])}
    </View>
  );
}

export default function Home() {
  const { projectId } = useFieldSession();
  const project = useProject(projectId);
  const { buildingId } = useProjectBuilding();
  const { db, ready } = useLocalDb();

  return (
    <Page
      buildingScope
      buildingOptional
      stageScope
      title="Home"
      projectName={project.data?.name}
      projectPending={project.isPending}
      onPressProject={() => router.push("/select-project")}
      rightButtons={<HeaderIconButton icon="options-outline" label="Customise Home" onPress={() => router.push("/tools/customise-home")} />}
    >
      {ready && db && projectId ? (
        <Dashboard key={`${projectId}:${buildingId ?? ""}`} db={db} projectId={projectId} buildingId={buildingId} />
      ) : (
        <View className="items-center py-12"><Spinner size="md" /></View>
      )}
    </Page>
  );
}

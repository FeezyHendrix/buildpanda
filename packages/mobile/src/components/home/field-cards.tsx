import { features } from "@/lib/feature-access";
import { router } from "expo-router";
import { View } from "react-native";
import { Button, PendingBadge, Text } from "@/components/atoms";
import type { Db } from "@/db/client";
import { defaultTemplate } from "@/db/daily-log-templates-repository";
import { todayIso } from "@/db/daily-logs-repository";
import type { TaskRow } from "@/db/schema";
import { useDailyLogTemplates } from "@/hooks/use-daily-log-templates";
import { useDailyLogDay } from "@/hooks/use-daily-logs";
import { useMaterialLog } from "@/hooks/use-material-log";
import { useProjectAccess } from "@/hooks/use-project-access";
import { useTaskBoard } from "@/hooks/use-tasks";
import { formatDateTime, formatShortDate } from "@/lib/dates";
import { CardEmpty, CardRow, HomeCard } from "./home-card";

interface Scope {
  db: Db;
  projectId: string;
  buildingId: string;
}

const qty = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

export function DailyLogCard({ db, projectId, buildingId }: Scope) {
  const today = todayIso();
  const { day, entries } = useDailyLogDay(db, projectId, today, buildingId);
  const templates = useDailyLogTemplates(db, projectId);
  const { allows } = useProjectAccess();
  const form = defaultTemplate(templates.data) ?? templates.data[0];
  const count = entries.length;

  return (
    <HomeCard title="Today's daily log" subtitle={count ? `${count} site ${count === 1 ? "note" : "notes"}` : day ? "No site notes yet" : "Nothing logged yet today"} href={day ? `/tools/daily-log/${today}` : `/tools/daily-log/new?date=${today}`}>
      {allows(features.dailyLog.actions.create) ? (
        <Button
          variant={count ? "secondary" : "primary"}
          onPress={() => router.push((!day ? `/tools/daily-log/new?date=${today}` : form ? `/tools/daily-log/fill?date=${today}&templateId=${encodeURIComponent(form.id)}` : `/tools/daily-log/${today}`) as never)}
        >
          {!day ? "Start today's log" : form ? `Fill ${form.name}` : "Add a site note"}
        </Button>
      ) : null}
    </HomeCard>
  );
}

function taskMeta(task: TaskRow, today: string): string {
  if (!task.dueDate) return task.priority === "High" ? "High priority" : "No due date";
  const due = task.dueDate.slice(0, 10);
  return due < today ? `Overdue · was due ${formatShortDate(due)}` : due === today ? "Due today" : `Due ${formatShortDate(due)}`;
}

export function TasksCard({ db, projectId, buildingId, myOpen }: Scope & { myOpen: readonly TaskRow[] }) {
  const { can } = useProjectAccess();
  // opening Home keeps the board fresh, so the counts above are current
  useTaskBoard(db, projectId, buildingId, can("tasks", "viewAll"));
  const today = todayIso();
  return (
    <HomeCard title="My tasks" subtitle={myOpen.length ? `${myOpen.length} open` : undefined} href="/tools/tasks">
      {myOpen.length === 0 ? (
        <CardEmpty>No open tasks created by or assigned to you.</CardEmpty>
      ) : (
        myOpen.slice(0, 3).map((task) => (
          <CardRow
            key={task.id}
            title={task.title}
            meta={taskMeta(task, today)}
            onPress={() => router.push(`/tools/tasks/${encodeURIComponent(task.id)}` as never)}
            trailing={task.isPendingSync ? <PendingBadge /> : null}
          />
        ))
      )}
    </HomeCard>
  );
}

export function MaterialLogCard({ db, projectId, awaiting }: Omit<Scope, "buildingId"> & { awaiting: number }) {
  const { entries } = useMaterialLog(db, projectId);
  const { allows } = useProjectAccess();
  const recent = entries.filter((e) => e.entryType === "IN").slice(0, 3);
  return (
    <HomeCard title="Deliveries" subtitle={awaiting ? `${awaiting} awaiting approval` : "Material received on site"} href="/tools/material-log">
      {recent.length === 0 ? (
        <CardEmpty>No deliveries logged yet.</CardEmpty>
      ) : (
        recent.map((entry) => (
          <CardRow
            key={entry.id}
            title={`${qty(entry.quantity)} ${entry.unit} ${entry.materialName}`}
            meta={[formatDateTime(entry.occurredAt), entry.approvalStatus === "Pending" ? "Awaiting approval" : entry.approvalStatus].join(" · ")}
            trailing={entry.isPendingSync ? <PendingBadge /> : null}
          />
        ))
      )}
      {allows(features.materialLog.actions.create) ? (
        <View className="pt-3">
          <Button variant="secondary" onPress={() => router.push("/tools/material-log/new")}>Log a delivery</Button>
        </View>
      ) : null}
    </HomeCard>
  );
}

export function SyncNote({ failed }: { failed: number }) {
  if (!failed) return null;
  return (
    <View className="rounded-xl bg-error-50 px-4 py-3">
      <Text tone="danger" className="text-sm" onPress={() => router.push("/sync")}>
        {failed} {failed === 1 ? "change" : "changes"} couldn&apos;t upload. Tap to review.
      </Text>
    </View>
  );
}
